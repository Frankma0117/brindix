"""Un pedido de principio a fin: guion → voz por escena → capturas reales → escenario con la copa que habla → un MP4 por formato.

El guion, la voz, las capturas y la mezcla de audio se hacen una sola vez; solo el escenario se graba por cada formato.
"""
import logging
import os
import shutil
import tempfile

import media
import script as scripts
from catalog import FORMATS, KINDS, MUSIC, SHOTS, VOICES

log = logging.getLogger("studio.pipeline")
INTRO_PAD, SCENE_PAD, OUTRO_HOLD = 0.35, 0.45, 2.2
RENDER_FROM, RENDER_TO = 40, 88


def run(job: dict, progress) -> dict:
    """job: id, kind, formats (o format), idea, voice, music. Devuelve las URLs por formato y el guion."""
    try:
        os.nice(10)  # el bar y el panel siempre van primero; el estudio usa la CPU que sobra
    except (AttributeError, OSError):
        pass
    work = tempfile.mkdtemp(prefix="studio-")
    try:
        formats = [f for f in (job.get("formats") or [job.get("format")]) if f in FORMATS] or ["vertical"]
        v = next((x for x in VOICES if x["key"] == job.get("voice")), VOICES[0])

        progress("Escribiendo el guion", 5)
        sc = scripts.write(job.get("kind", "anuncio"), job.get("idea", ""), v["name"])

        # Voz por escena y línea de tiempo.
        clips, timeline, t = [], [], 0.0
        for i, s in enumerate(sc["scenes"]):
            progress(f"Grabando la voz ({i + 1}/{len(sc['scenes'])})", 8 + int(i / len(sc["scenes"]) * 17))
            path = os.path.join(work, f"voz-{i}.mp3")
            if not media.voice(s["say"], v["id"], path):
                raise RuntimeError("No se pudo grabar la voz (revisa FISH_API_KEY en el servidor)")
            d = media.duration(path)
            start = t + (INTRO_PAD if i == 0 else SCENE_PAD)
            clips.append((path, start))
            timeline.append({**s, "start": round(t, 3), "voiceAt": round(start, 3), "voiceLen": round(d, 3),
                             "end": round(start + d + (OUTRO_HOLD if i == len(sc["scenes"]) - 1 else 0.25), 3),
                             "levels": media.levels(path), "device": SHOTS.get(s["shot"], {}).get("device"),
                             "label": SHOTS.get(s["shot"], {}).get("label")})
            t = timeline[-1]["end"]
        total = round(t + 0.4, 2)

        shots = [s["shot"] for s in sc["scenes"] if s["shot"] in SHOTS]
        progress("Abriendo la demo real de Brindix", 27)
        caps = media.capture(shots, lambda m: progress(m, 32))

        progress("Preparando la música", 36)
        style = job.get("music") if job.get("music") in MUSIC else "fiesta"
        music = media.music(style, MUSIC[style], work)
        progress("Mezclando voz y música", 38)
        audio = os.path.join(work, "audio.m4a")
        media.soundtrack(clips, music, total, audio)

        qr = media.qr("https://brindix.cania.app")
        poster_at = round(min(total - 0.5, timeline[1]["voiceAt"] + 1.2 if len(timeline) > 1 else 1.5), 2)
        videos = []
        span = (RENDER_TO - RENDER_FROM) / len(formats)
        for n, fmt in enumerate(formats):
            size = FORMATS[fmt]
            base = RENDER_FROM + n * span
            tag = f"{fmt} ({n + 1}/{len(formats)})" if len(formats) > 1 else fmt

            def step(msg, pct=None, _base=base, _span=span, _tag=tag):
                # El avance de media.render va de 40 a 90; se reparte en el tramo de este formato.
                p = None if pct is None else int(_base + (max(0, min(50, pct - 40)) / 50) * _span)
                progress(f"{msg} · {_tag}", p)

            stage = {"format": fmt, "width": size[0], "height": size[1], "fps": media.FPS, "total": total,
                     "scenes": timeline, "captures": caps, "qr": qr, "posterAt": poster_at}
            video, poster = os.path.join(work, f"video-{fmt}.mp4"), os.path.join(work, f"poster-{fmt}.jpg")
            media.render(stage, size, total, video, poster, step)
            final = os.path.join(work, f"final-{fmt}.mp4")
            media.mux(video, audio, final)
            progress(f"Subiendo el video {tag}", int(base + span))
            with open(final, "rb") as f:
                video_url = media.put(f"{job['id']}/{fmt}/brindix-{job.get('kind', 'video')}-{fmt}.mp4", f.read(), "video/mp4")
            with open(poster, "rb") as f:
                poster_url = media.put(f"{job['id']}/{fmt}/poster.jpg", f.read(), "image/jpeg")
            videos.append({"format": fmt, "videoUrl": video_url, "posterUrl": poster_url, "seconds": total})

        return {"videos": videos, "seconds": total, "title": sc["title"], "caption": sc["caption"],
                "script": [{k: s[k] for k in ("shot", "headline", "say")} for s in sc["scenes"]],
                "kindName": KINDS.get(job.get("kind"), {}).get("name", "")}
    finally:
        shutil.rmtree(work, ignore_errors=True)
