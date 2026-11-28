"""Servicio interno del estudio (solo lo llama el backend de Brindix por la red de Docker).

POST /narrate {spec, voice, music}                   → {seconds, audio(base64 mp3)} para la versión final de «recuadros»
POST /jobs  {id, kind, formats, idea, voice, music} → encola el pedido (un MP4 por formato; uno a la vez)
GET  /jobs/{id}                                      → estado, progreso y, al terminar, las URLs
DELETE /videos/{id}/{formato}                        → borra ese MP4 y su portada de Spaces
GET  /voices/{clave}/sample                          → muestra de la voz (mp3 en Spaces)
GET  /options                                        → tipos, formatos, voces y músicas
"""
import base64
import logging
import os
import shutil
import queue
import threading
import time
import traceback

from fastapi import FastAPI, Header, HTTPException

import falvoices
import media
import narrate
import pipeline
from catalog import FORMATS, KINDS, MUSIC, VOICES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("studio")
app = FastAPI(title="Brindix Studio")
TOKEN = os.environ.get("STUDIO_TOKEN", "")
jobs: dict[str, dict] = {}
pending: "queue.Queue[dict]" = queue.Queue()


def _auth(token: str | None) -> None:
    if not TOKEN or token != TOKEN:
        raise HTTPException(401, "token inválido")


@app.get("/health")
def health():
    return {"ok": True, "queue": pending.qsize()}


# Chris narra la información y Matilda es la voz de la copa (intro y cierre): ver narrate.COPA_VOICE
FAL_OPTION = {"key": "eleven2:Chris", "gender": "male", "name": "Chris + Matilda (ElevenLabs)",
              "style": "Chris narra la información y Matilda es la voz de la copa"}


@app.get("/options")
def options(x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    return {"kinds": [{"key": k, "name": v["name"], "about": v["about"], "seconds": v["seconds"]} for k, v in KINDS.items()],
            "formats": [{"key": k, "width": w, "height": h} for k, (w, h) in FORMATS.items()],
            "voices": ([FAL_OPTION] if os.environ.get("FAL_KEY") else []) + [{k: v[k] for k in ("key", "name", "style", "gender")} for v in VOICES],
            "music": list(MUSIC.keys()),
            "voiceReady": bool(os.environ.get("FISH_API_KEY") or os.environ.get("FAL_KEY")), "aiReady": bool(os.environ.get("AI_API_KEY"))}


@app.post("/jobs")
def create(job: dict, x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    jid = str(job.get("id") or "")
    if not jid:
        raise HTTPException(400, "falta id")
    jobs[jid] = {"status": "QUEUED", "progress": 0, "detail": "En cola", "at": time.time()}
    pending.put(job)
    return jobs[jid]


@app.post("/narrate")
def narrate_video(body: dict, x_studio_token: str | None = Header(None)):
    """Voz Fish por escena + música en una pista mp3, y los segundos que necesita cada bloque del video."""
    _auth(x_studio_token)
    spec = body.get("spec")
    if not isinstance(spec, dict):
        raise HTTPException(400, "falta el guion (spec)")
    try:
        seconds, path, work = narrate.narrate(spec, body.get("voice"), body.get("music"))
    except narrate.NarrateError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        log.error("narración falló: %s | %s", type(e).__name__, traceback.format_exc())
        raise HTTPException(502, "No se pudo generar el audio. Intenta de nuevo.")
    try:
        with open(path, "rb") as f:
            audio = base64.b64encode(f.read()).decode()
    finally:
        shutil.rmtree(work, ignore_errors=True)
    return {"seconds": seconds, "audio": audio}


@app.get("/jobs/{jid}")
def status(jid: str, x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    if jid not in jobs:
        raise HTTPException(404, "no existe")
    return jobs[jid]


@app.delete("/videos/{jid}/{fmt}")
def delete(jid: str, fmt: str, x_studio_token: str | None = Header(None)):
    """Borra el MP4 y la portada de un formato del pedido (los demás formatos siguen)."""
    _auth(x_studio_token)
    if not jid.isdigit() or fmt not in FORMATS:
        raise HTTPException(400, "id o formato inválido")
    return {"removed": media.remove(f"{jid}/{fmt}")}


SAMPLE_TEXT = "¡Hola! Soy la copa de Brindix. Con esta voz le cuento a tu bar cómo vender más y cuadrar la caja sin papel."


@app.get("/voices/{key}/sample")
def voice_sample(key: str, x_studio_token: str | None = Header(None)):
    """Muestra de una voz (se graba una sola vez y queda en Spaces)."""
    _auth(x_studio_token)
    if key == FAL_OPTION["key"]:
        try:
            return {"url": falvoices.sample("eleven2", "Chris"), "name": FAL_OPTION["name"], "style": FAL_OPTION["style"]}
        except Exception as e:  # noqa: BLE001
            raise HTTPException(503, "No se pudo grabar la muestra (revisa FAL_KEY)") from e
    v = next((x for x in VOICES if x["key"] == key), None)
    if not v:
        raise HTTPException(404, "esa voz no existe")
    url = media.voice_sample(v, SAMPLE_TEXT)
    if not url:
        raise HTTPException(503, "No se pudo grabar la muestra (revisa FISH_API_KEY)")
    return {"url": url, "name": v["name"], "style": v["style"]}


@app.get("/fal-voices")
def fal_voices(x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    return falvoices.catalog()


@app.get("/fal-voices/{model}/{voice}/sample")
def fal_voice_sample(model: str, voice: str, x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    try:
        return {"url": falvoices.sample(model, voice)}
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:  # noqa: BLE001
        log.warning("muestra fal %s/%s: %s", model, voice, e)
        raise HTTPException(502, "No se pudo grabar la muestra con fal.ai")


def worker() -> None:
    while True:
        job = pending.get()
        jid = str(job["id"])
        state = jobs.setdefault(jid, {})

        def progress(detail: str, pct: int | None = None, _s=state):
            _s.update(status="RUNNING", detail=detail, **({"progress": pct} if pct is not None else {}))

        try:
            progress("Empezando", 1)
            result = pipeline.run(job, progress)
            state.update(status="DONE", progress=100, detail="Listo", result=result)
        except Exception as e:  # noqa: BLE001
            log.error("video %s falló: %s\n%s", jid, e, traceback.format_exc())
            state.update(status="FAILED", detail=str(e)[:300])


threading.Thread(target=worker, daemon=True).start()
