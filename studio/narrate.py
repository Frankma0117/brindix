"""Audio de la versión final de los videos «recuadros»: voz Fish por escena + música, en una sola pista mp3.

Recibe el spec del taller (Remotion, 30 fps), calcula cuánto dura cada bloque (intro, escenas, cierre) para que la voz
quepa, y devuelve esos segundos junto con el mp3 ya mezclado y colocado en el tiempo de cada bloque.
"""
import hashlib
import logging
import os
import re
import shutil
import subprocess
import tempfile

import requests

import falvoices
import media
from catalog import MUSIC, VOICES

log = logging.getLogger("studio.narrate")
TFPS = 30  # los cuadros por segundo del taller (taller/src/lib/spec.ts)
VOICE_OFFSET = 0.35  # la voz entra un instante después de que aparece el bloque
VOICE_TAIL = 0.45    # y deja un respiro antes del siguiente (offset + cola = 0.8 s)


class NarrateError(Exception):
    """Falla con un mensaje en español listo para mostrar."""


def _frames(seconds: float) -> int:
    return round(seconds * TFPS)


def _join(parts: list[str]) -> str:
    out = []
    for p in parts:
        p = (p or "").strip()
        if p:
            out.append(p if p[-1] in ".!?…:" else p + ".")
    return " ".join(out)


def _list(items: list[str]) -> str:
    items = [i.strip().rstrip(".") for i in items if i and i.strip()]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " y " + items[-1]


def default_scene_text(scene: dict) -> str:
    texts = [c.get("text", "") for c in scene.get("callouts") or []]
    tail = f"Fíjate: {_list(texts)}." if any(t.strip() for t in texts) else ""
    return _join([scene.get("title", ""), scene.get("sub", ""), tail])


def blocks(spec: dict) -> list[dict]:
    """Intro, escenas y cierre con su texto hablado y los segundos base (los del spec o los del taller)."""
    intro, outro = spec.get("intro") or {}, spec.get("outro") or {}
    out = [{"kind": "intro", "text": (intro.get("say") or "").strip() or _join([intro.get("title", ""), intro.get("sub", "")]),
            "base": float(intro.get("seconds") or 3)}]
    for s in spec.get("scenes") or []:
        n = len(s.get("callouts") or [])
        out.append({"kind": "scene", "text": (s.get("say") or "").strip() or default_scene_text(s),
                    "base": float(s.get("seconds") or max(5, 2.6 + 1.2 * n))})
    out.append({"kind": "outro", "text": (outro.get("say") or "").strip() or _join([outro.get("title", ""), outro.get("cta", "")]),
                "base": float(outro.get("seconds") or 4)})
    return out


def _cache_url(h: str) -> str:
    prefix = os.environ.get("SPACES_PREFIX", "brindix").strip("/")
    return media.public_url(f"{prefix}/studio/voicecache/{h}.mp3" if prefix else f"studio/voicecache/{h}.mp3")


COPA_VOICE = ("eleven2", "Matilda")  # la copa habla en la intro y el cierre; la narración informativa usa la voz elegida
FAL_VOICE = re.compile(r"^([a-z0-9]{3,10}):([A-Za-z0-9_-]{2,40})$")


def _voice(text: str, voice: dict, path: str) -> None:
    """Voz de un trozo: primero la caché por hash (Spaces); si no está, Fish o fal y se guarda."""
    fal = voice.get("fal")
    model = f"fal-{fal[0]}" if fal else os.environ.get("FISH_MODEL", "s2-pro")
    h = hashlib.sha256(f"{model}|{fal[1] if fal else voice['id']}|{text}".encode()).hexdigest()[:40]
    try:
        r = requests.get(_cache_url(h), timeout=20)
        if r.ok and r.content:
            with open(path, "wb") as f:
                f.write(r.content)
            return
    except Exception:  # noqa: BLE001 — sin caché se pide a Fish
        pass
    if fal:
        try:
            falvoices.speak(fal[0], fal[1], text, path)
        except Exception as e:  # noqa: BLE001
            log.warning("fal tts: %s", e)
            raise NarrateError("No se pudo grabar la voz (revisa FAL_KEY o el saldo de fal.ai).") from e
    elif not media.voice(text, voice["id"], path):
        raise NarrateError("No se pudo grabar la voz (revisa FISH_API_KEY o el saldo de Fish Audio).")
    try:
        with open(path, "rb") as f:
            media.put(f"voicecache/{h}.mp3", f.read(), "audio/mpeg")
    except Exception as e:  # noqa: BLE001 — la caché es opcional
        log.warning("no se guardó la voz en la caché: %s", e)


def _mix(clips: list[tuple[str, float]], music_path: str | None, total: float, out_path: str) -> None:
    inputs, chains, labels = [], [], []
    for i, (path, at) in enumerate(clips):
        ms = int(round(at * 1000))
        inputs += ["-i", path]
        chains.append(f"[{i}:a]aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{i}]")
        labels.append(f"[v{i}]")
    mix = None
    if labels:
        chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,volume=1.6[voice]")
        mix = "[voice]"
    if music_path:
        inputs += ["-stream_loop", "-1", "-i", music_path]
        m = len(clips)
        chains.append(f"[{m}:a]aformat=channel_layouts=stereo,volume=0.13,afade=t=in:d=1.5,"
                      f"afade=t=out:st={max(0, total - 2.5):.2f}:d=2.5[mus]")
        if mix:
            chains.append("[voice][mus]amix=inputs=2:normalize=0[mix]")
            mix = "[mix]"
        else:
            mix = "[mus]"
    chains.append(f"{mix}atrim=0:{total:.2f},apad=whole_dur={total:.2f},loudnorm=I=-16:TP=-1.5[out]")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains), "-map", "[out]",
                    "-c:a", "libmp3lame", "-ar", "44100", "-b:a", "160k", out_path], check=True)


def narrate(spec: dict, voice_key: str | None, music_key: str | None) -> tuple[dict, str, str]:
    """Devuelve ({intro, scenes, outro} en segundos, ruta del mp3, carpeta de trabajo que quien llama debe borrar)."""
    m = FAL_VOICE.match(voice_key or "")
    if m and m.group(1) in falvoices.MODELS and m.group(2) in falvoices.MODELS[m.group(1)]["voices"]:
        voice = {"key": voice_key, "fal": (m.group(1), m.group(2))}
        use_voice = bool(os.environ.get("FAL_KEY"))
    else:
        voice = next((v for v in VOICES if v["key"] == voice_key), None)
        use_voice = bool(voice) and bool(os.environ.get("FISH_API_KEY"))
    style = music_key if music_key in MUSIC else None
    if not use_voice and not style:
        raise NarrateError("Elige una voz (con Fish configurado) o una música: sin ninguna no hay audio que generar.")
    work = tempfile.mkdtemp(prefix="narrate-")
    try:
        items = blocks(spec)
        voices: list[tuple[str, float] | None] = [None] * len(items)
        if use_voice:
            for i, b in enumerate(items):
                if not b["text"]:
                    continue
                path = os.path.join(work, f"voz-{i}.mp3")
                # la copa (intro y cierre) habla con su propia voz cuando la narración es de fal
                _voice(b["text"], {"key": "copa", "fal": COPA_VOICE} if voice.get("fal") and b["kind"] != "scene" else voice, path)
                voices[i] = (path, media.duration(path))
        # segundos finales: lo que ya tenía el bloque, o lo que pida la voz (+0.8 s)
        secs = [max(b["base"], (v[1] + VOICE_OFFSET + VOICE_TAIL) if v else 0) for b, v in zip(items, voices)]
        frs = [_frames(s) for s in secs]
        secs = [f / TFPS for f in frs]
        clips, at = [], 0
        for v, f in zip(voices, frs):
            if v:
                clips.append((v[0], at / TFPS + VOICE_OFFSET))
            at += f
        total = at / TFPS
        music_path = None
        if style:
            music_path = media.music(style, MUSIC[style], work)
            if not music_path:
                raise NarrateError("No se pudo preparar la música (revisa FAL_KEY o Spaces).")
        out = os.path.join(work, "audio.mp3")
        _mix(clips, music_path, total, out)
        seconds = {"intro": round(secs[0], 3), "scenes": [round(s, 3) for s in secs[1:-1]], "outro": round(secs[-1], 3)}
        return seconds, out, work
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise
