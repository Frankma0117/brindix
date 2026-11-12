"""Servicio interno del estudio (solo lo llama el backend de Brindix por la red de Docker).

POST /jobs  {id, kind, format, idea, voice, music}  → encola el video (uno a la vez)
GET  /jobs/{id}                                      → estado, progreso y, al terminar, las URLs
DELETE /videos/{id}                                  → borra el video y su portada de Spaces
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
            "voices": [{k: v[k] for k in ("key", "name", "style")} for v in VOICES],
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


@app.delete("/videos/{jid}")
def delete(jid: str, x_studio_token: str | None = Header(None)):
    _auth(x_studio_token)
    if not jid.isdigit():
        raise HTTPException(400, "id inválido")
    jobs.pop(jid, None)
    return {"removed": media.remove(jid)}


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
