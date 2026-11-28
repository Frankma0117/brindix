"""Voces de fal.ai para escuchar y elegir: la muestra se graba una vez y queda en Spaces."""
import os
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse

import requests

import media

TEXT = ("Aquí puedes ver todas las mesas de tu bar. Toca una mesa para abrir la cuenta, "
        "agregar un pedido y cobrar, sin papel y sin enredos.")

# model -> (endpoint de fal, nombre visible, precio por 1.000 caracteres, voces)
MODELS = {
    "kokoro": {"name": "Kokoro (español)", "endpoint": "fal-ai/kokoro/spanish", "price": 0.02,
               "voices": ["ef_dora", "em_alex", "em_santa"]},
    "minimax": {"name": "MiniMax Speech HD (voces en español)", "endpoint": "fal-ai/minimax/speech-02-hd", "price": 0.10,
                "voices": ["Spanish_SereneWoman", "Spanish_MaturePartner", "Spanish_CaptivatingStoryteller", "Spanish_Narrator", "Spanish_WiseScholar", "Spanish_Kind-heartedGirl", "Spanish_DeterminedManager", "Spanish_ReservedYoungMan", "Spanish_ConfidentWoman", "Spanish_ThoughtfulMan", "Spanish_SophisticatedLady", "Spanish_RationalMan", "Spanish_Deep-tonedMan", "Spanish_FrankLady", "Spanish_Wiselady", "Spanish_Steadymentor", "Spanish_Jovialman", "Spanish_Intonategirl", "Spanish_EnergeticBoy", "Spanish_WhimsicalGirl", "Spanish_ReliableMan", "Spanish_SereneElder", "Spanish_CaringGirlfriend"]},
    "eleven2": {"name": "ElevenLabs Multilingual v2", "endpoint": "fal-ai/elevenlabs/tts/multilingual-v2", "price": 0.05,
               "voices": ["Rachel", "Aria", "Roger", "Sarah", "Laura", "Charlie", "George", "Callum", "River",
                          "Liam", "Charlotte", "Alice", "Matilda", "Will", "Jessica", "Eric", "Chris", "Brian",
                          "Daniel", "Lily", "Bill"]},
}


def catalog() -> list[dict]:
    return [{"key": k, "name": m["name"], "price": m["price"], "voices": m["voices"]} for k, m in MODELS.items()]


def _body(model: str, voice: str) -> dict:
    if model == "kokoro":
        return {"prompt": TEXT, "voice": voice}
    if model == "minimax":
        return {"text": TEXT, "voice_setting": {"voice_id": voice}, "language_boost": "Spanish", "output_format": "url"}
    return {"text": TEXT, "voice": voice, "language_code": "es"}


def sample(model: str, voice: str) -> str:
    m = MODELS.get(model)
    if not m or voice not in m["voices"]:
        raise ValueError("esa voz no existe")
    key = f"voices-fal/{model}-{voice}.mp3"
    prefix = os.environ.get("SPACES_PREFIX", "brindix").strip("/")
    url = media.public_url(f"{prefix}/studio/{key}" if prefix else f"studio/{key}")
    try:
        if requests.head(url, timeout=10).ok:
            return url
    except requests.RequestException:
        pass
    fal_key = os.environ.get("FAL_KEY")
    if not fal_key:
        raise RuntimeError("Falta FAL_KEY")
    r = requests.post(f"https://fal.run/{m['endpoint']}", timeout=120,
                      headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
                      json=_body(model, voice))
    r.raise_for_status()
    j = r.json()
    audio_url = (j.get("audio") or j.get("audio_file") or {}).get("url")
    if not audio_url or not (urlparse(audio_url).hostname or "").endswith(("fal.media", "fal.ai")):
        raise RuntimeError("respuesta inesperada de fal")
    tmp = tempfile.mkdtemp(prefix="falvoice-")
    try:
        raw, out = os.path.join(tmp, "raw"), os.path.join(tmp, "s.mp3")
        with open(raw, "wb") as f:
            f.write(requests.get(audio_url, timeout=60).content)
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-ac", "1", "-b:a", "96k", out], check=True)
        with open(out, "rb") as f:
            return media.put(key, f.read(), "audio/mpeg")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
