"""Guion del video: la IA lo escribe con reglas estrictas; si no hay IA o responde mal, una plantilla fija."""
import json
import logging
import os
import re

import requests

from catalog import FEATURES, KINDS, SHOTS

log = logging.getLogger("studio.script")

RULES = f"""Eres el guionista de videos cortos de Brindix para redes sociales (TikTok, Reels, YouTube Shorts) y tutoriales.
{FEATURES}
Reglas:
- Español de Colombia, cercano y claro, sin exagerar ni prometer cosas que Brindix no hace.
- La narración la dice la mascota de Brindix: una copa de cóctel con audífonos, simpática. Habla en primera persona
  ("yo te muestro…") solo a veces; nunca dice que es una IA.
- Cada escena: "shot" (una de: {', '.join(SHOTS)}, o "intro"/"cierre"), "headline" (máximo 6 palabras, va en pantalla)
  y "say" (lo que dice la voz, máximo 26 palabras, frases cortas, sin emojis ni símbolos raros).
- Primera escena "intro" con un gancho fuerte; última escena "cierre" que invita a entrar a brindix.cania.app o pedir una demo.
- Solo muestra pantallas que existan en la lista. No inventes precios, clientes, cifras de ventas ni testimonios.
Responde SOLO un JSON: {{"title": "...", "caption": "texto para publicar con 2-4 hashtags", "scenes": [...]}}"""


def template(kind: str, idea: str) -> dict:
    """Guion fijo, sin IA."""
    k = KINDS.get(kind, KINDS["anuncio"])
    lines = {
        "carta": ("La carta en el celular", "Cada mesa tiene su QR. El cliente ve la carta con fotos y pide sin descargar nada."),
        "musica": ("Tu canción, desde la mesa", "Los clientes buscan su canción y la ponen en la lista. Tú decides el orden."),
        "mesas": ("Todas las mesas a la vista", "El mesero ve en su celular qué mesas están libres y cuánto debe cada una."),
        "pedido": ("Seis cervezas, dos toques", "Toca el producto, elige la tanda y envía. La ronda queda en la cuenta correcta."),
        "cuenta": ("Cobra por ronda o completo", "Cobra en efectivo, Nequi o tarjeta, con propina, y libera la mesa."),
        "resumen": ("Así va tu noche", "El resumen te muestra mesas abiertas, pedidos por asignar y el efectivo en caja."),
        "caja": ("La caja cuadra sola", "Abres con la base, registras lo que sale y al cerrar ves la diferencia exacta."),
        "carta_admin": ("Precio, costo y ganancia", "Cada producto tiene su costo, así sabes cuánto ganas en cada venta."),
        "inventario": ("Inventario sin cuadernos", "Las compras actualizan el inventario y el costo promedio de cada producto."),
        "pantalla": ("El TV trabaja por ti", "La pantalla muestra lo que suena, lo que sigue y tus promociones con foto."),
        "landing": ("Brindix para tu bar", "Todo tu bar en el celular: carta, pedidos, caja y música."),
    }
    scenes = [{"shot": "intro", "headline": "Tu bar, en el celular", "say": "¿Tu bar todavía anota pedidos en papelitos? Te muestro algo mejor."}]
    for s in k["shots"]:
        h, say = lines[s]
        scenes.append({"shot": s, "headline": h, "say": say})
    scenes.append({"shot": "cierre", "headline": "Pide tu demo", "say": "Entra a brindix punto cania punto app y pide una demo para tu bar. ¡Salud!"})
    return {"title": k["name"], "caption": "Tu bar en el celular con Brindix. #bares #restaurantes #Colombia", "scenes": scenes}


def write(kind: str, idea: str, voice_name: str) -> dict:
    fallback = template(kind, idea)
    key, base, model = os.environ.get("AI_API_KEY"), os.environ.get("AI_BASE_URL"), os.environ.get("AI_MODEL")
    if not (key and base and model):
        return fallback
    k = KINDS.get(kind, KINDS["anuncio"])
    prompt = (f"Tipo de video: {k['name']}. De qué trata: {k['about']} Duración aproximada: {k['seconds']} segundos "
              f"({max(4, k['seconds'] // 8)} a {max(5, k['seconds'] // 6)} escenas en total). Pantallas sugeridas: {', '.join(k['shots'])}. "
              f"Voz: {voice_name}. Indicaciones del administrador: {idea or 'ninguna'}.")
    try:
        r = requests.post(base.rstrip("/") + "/chat/completions", timeout=90,
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                          json={"model": model, "temperature": 0.8, "response_format": {"type": "json_object"},
                                "messages": [{"role": "system", "content": RULES}, {"role": "user", "content": prompt}]})
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"]
        return clean(json.loads(raw[raw.find("{"): raw.rfind("}") + 1]), fallback)
    except Exception as e:  # noqa: BLE001 — cualquier fallo de la IA cae a la plantilla
        log.warning("guion con IA falló, se usa plantilla: %s", e)
        return fallback


def clean(data: dict, fallback: dict) -> dict:
    """Valida el JSON de la IA: pantallas existentes, textos cortos, intro y cierre."""
    scenes = []
    for s in data.get("scenes", [])[:10]:
        shot = str(s.get("shot", "")).strip()
        if shot not in SHOTS and shot not in ("intro", "cierre"):
            continue
        say = re.sub(r"[^\w\s.,;:¡!¿?()áéíóúñÁÉÍÓÚÑüÜ'%$-]", "", str(s.get("say", ""))).strip()
        head = str(s.get("headline", "")).strip()
        if not say:
            continue
        scenes.append({"shot": shot, "headline": " ".join(head.split()[:7]), "say": " ".join(say.split()[:34])})
    if len(scenes) < 3 or scenes[0]["shot"] != "intro" or scenes[-1]["shot"] != "cierre":
        return fallback
    return {"title": str(data.get("title") or fallback["title"])[:120], "caption": str(data.get("caption") or fallback["caption"])[:600],
            "scenes": scenes}
