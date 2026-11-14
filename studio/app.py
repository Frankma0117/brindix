"""Servicio interno del estudio (solo lo llama el backend de Brindix por la red de Docker).

POST /jobs  {id, kind, formats, idea, voice, music} → encola el pedido (un MP4 por formato; uno a la vez)
GET  /jobs/{id}                                      → estado, progreso y, al terminar, las URLs
DELETE /videos/{id}/{formato}                        → borra ese MP4 y su portada de Spaces
GET  /voices/{clave}/sample                          → muestra de la voz (mp3 en Spaces)
GET  /options                                        → tipos, formatos, voces y músicas
"""
import logging
import os
import queue
import threading
import time
import traceback

from fastapi import FastAPI, Header, HTTPException

import media
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


@app.get("/options")
def options(x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    return {"kinds": [{"key": k, "name": v["name"], "about": v["about"], "seconds": v["seconds"]} for k, v in KINDS.items()],
            "formats": [{"key": k, "width": w, "height": h} for k, (w, h) in FORMATS.items()],
            "voices": [{k: v[k] for k in ("key", "name", "style", "gender")} for v in VOICES],
            "music": list(MUSIC.keys()),
            "voiceReady": bool(os.environ.get("FISH_API_KEY")), "aiReady": bool(os.environ.get("AI_API_KEY"))}


@app.post("/jobs")
def create(job: dict, x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    jid = str(job.get("id") or "")
    if not jid:
        raise HTTPException(400, "falta id")
    jobs[jid] = {"status": "QUEUED", "progress": 0, "detail": "En cola", "at": time.time()}
    pending.put(job)
    return jobs[jid]


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
    v = next((x for x in VOICES if x["key"] == key), None)
    if not v:
        raise HTTPException(404, "esa voz no existe")
    url = media.voice_sample(v, SAMPLE_TEXT)
    if not url:
        raise HTTPException(503, "No se pudo grabar la muestra (revisa FISH_API_KEY)")
    return {"url": url, "name": v["name"], "style": v["style"]}


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
