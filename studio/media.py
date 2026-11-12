"""Voz (Fish Audio), niveles para mover la boca de la copa, música (fal.ai, una vez por estilo), capturas de la demo
real con Playwright, almacenamiento en DigitalOcean Spaces y render del MP4 con ffmpeg."""
import base64
import io
import json
import logging
import os
import struct
import subprocess
import time
from urllib.parse import urlparse

import boto3
import requests

log = logging.getLogger("studio.media")
FPS = 25
INTERNAL = os.environ.get("BRINDIX_INTERNAL_URL", "http://frontend").rstrip("/")


# ---------------- Voz ----------------

def voice(text: str, voice_id: str, out_path: str) -> bool:
    key = os.environ.get("FISH_API_KEY")
    if not key:
        return False
    r = requests.post("https://api.fish.audio/v1/tts", timeout=120,
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                               "model": os.environ.get("FISH_MODEL", "s2-pro")},
                      json={"text": text, "reference_id": voice_id, "format": "mp3", "mp3_bitrate": 128, "latency": "normal"})
    if not r.ok:
        log.warning("Fish Audio respondió %s: %s", r.status_code, r.text[:200])
        return False
    with open(out_path, "wb") as f:
        f.write(r.content)
    return True


def duration(path: str) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out or 0)


def levels(path: str) -> list[float]:
    """Volumen de la voz por cuadro (0 a 1): con esto la copa abre y cierra la boca al hablar."""
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    n = len(raw) // 2
    samples = struct.unpack(f"<{n}h", raw[: n * 2])
    win = 8000 // FPS
    vals = []
    for i in range(0, n, win):
        chunk = samples[i:i + win]
        if not chunk:
            break
        vals.append((sum(s * s for s in chunk) / len(chunk)) ** 0.5)
    top = max(vals) if vals else 1
    return [round(min(1.0, v / (top * 0.7)), 3) if top else 0 for v in vals]


def silence(seconds: float, out_path: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                    "-t", f"{seconds:.2f}", "-q:a", "4", out_path], check=True)


# ---------------- Almacenamiento ----------------

def _s3():
    return boto3.client("s3", region_name=os.environ.get("SPACES_REGION", "sfo3"), endpoint_url=os.environ.get("SPACES_ENDPOINT"),
                        aws_access_key_id=os.environ.get("SPACES_KEY"), aws_secret_access_key=os.environ.get("SPACES_SECRET"))


def public_url(key: str) -> str:
    cdn = os.environ.get("SPACES_CDN_URL", "").rstrip("/")
    if cdn:
        return f"{cdn}/{key}"
    host = urlparse(os.environ.get("SPACES_ENDPOINT", "")).hostname
    return f"https://{os.environ.get('SPACES_BUCKET')}.{host}/{key}"


def put(key: str, data: bytes, content_type: str) -> str:
    prefix = os.environ.get("SPACES_PREFIX", "brindix").strip("/")
    full = f"{prefix}/studio/{key}" if prefix else f"studio/{key}"
    _s3().put_object(Bucket=os.environ["SPACES_BUCKET"], Key=full, Body=data, ContentType=content_type, ACL="public-read",
                     CacheControl="public, max-age=31536000")
    return public_url(full)


def remove(folder: str) -> int:
    """Borra todo lo que quedó en studio/{folder}/ (el video y su portada)."""
    prefix = os.environ.get("SPACES_PREFIX", "brindix").strip("/")
    base = f"{prefix}/studio/{folder.strip('/')}/" if prefix else f"studio/{folder.strip('/')}/"
    s3, bucket = _s3(), os.environ["SPACES_BUCKET"]
    keys = [o["Key"] for o in s3.list_objects_v2(Bucket=bucket, Prefix=base).get("Contents", [])]
    if keys:
        s3.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": k} for k in keys]})
    return len(keys)


# ---------------- Música ----------------

def music(style: str, prompt: str | None, work: str) -> str | None:
    """Pista de fondo por estilo: se genera una sola vez con fal.ai y queda guardada en Spaces."""
    if not prompt:
        return None
    url = public_url(f"{os.environ.get('SPACES_PREFIX', 'brindix').strip('/')}/studio/music/{style}.mp3")
    path = os.path.join(work, "music.mp3")
    head = requests.head(url, timeout=15)
    if head.ok:
        with open(path, "wb") as f:
            f.write(requests.get(url, timeout=60).content)
        return path
    key = os.environ.get("FAL_KEY")
    if not key:
        return None
    try:
        r = requests.post("https://fal.run/CassetteAI/music-generator", timeout=300,
                          headers={"Authorization": f"Key {key}", "Content-Type": "application/json"},
                          json={"prompt": prompt, "duration": 90})
        r.raise_for_status()
        audio_url = r.json()["audio_file"]["url"]
        if not urlparse(audio_url).hostname.endswith(("fal.media", "fal.ai")):
            raise ValueError("respuesta inesperada")
        raw = os.path.join(work, "music-raw")
        with open(raw, "wb") as f:
            f.write(requests.get(audio_url, timeout=120).content)
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", raw, "-ac", "2", "-b:a", "160k", path], check=True)
        with open(path, "rb") as f:
            put(f"music/{style}.mp3", f.read(), "audio/mpeg")
        return path
    except Exception as e:  # noqa: BLE001 — sin música el video sigue
        log.warning("no se pudo generar la música: %s", e)
        return None


# ---------------- Capturas de la demo real ----------------

DEVICES = {
    "phone": {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 3, "is_mobile": True, "has_touch": True},
    "laptop": {"viewport": {"width": 1366, "height": 854}, "device_scale_factor": 1.5},
    "tv": {"viewport": {"width": 1280, "height": 720}, "device_scale_factor": 1.5},
}


def _api(path: str, token: str | None = None, body: dict | None = None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = (requests.post if body is not None else requests.get)(f"{INTERNAL}/api{path}", headers=h, json=body, timeout=30)
    r.raise_for_status()
    return r.json() if r.text else None


def capture(shots: list[str], progress) -> dict[str, str]:
    """Abre las páginas reales del bar de demostración y devuelve cada una como imagen (data URL JPEG)."""
    from playwright.sync_api import sync_playwright
    from catalog import SHOTS

    slug = os.environ.get("STUDIO_VENUE", "demo")
    admin = _api("/auth/login", body={"venue": slug, "username": os.environ.get("STUDIO_ADMIN_USER", "admin"),
                                      "password": os.environ.get("STUDIO_ADMIN_PASS", "")})
    waiter = _api("/auth/login", body={"venue": slug, "username": os.environ.get("STUDIO_WAITER_USER", "laura"),
                                       "password": os.environ.get("STUDIO_WAITER_PASS", "")})
    tables = _api("/admin/tables", admin["token"])
    code = next((t["code"] for t in tables if t["name"] == "Mesa 4"), tables[0]["code"])
    board = _api("/staff/board", waiter["token"])
    tab = next((t["tabId"] for t in board["tables"] if t.get("tabId")), None)
    routes = {
        "landing": ("/", None), "carta": (f"/{slug}/m/{code}", None), "musica": (f"/{slug}/m/{code}", "music"),
        "mesas": (f"/{slug}/mesero", waiter), "pedido": (f"/{slug}/mesero/cuenta/{tab}?agregar=1", waiter),
        "cuenta": (f"/{slug}/mesero/cuenta/{tab}", waiter), "resumen": (f"/{slug}/admin", admin),
        "caja": (f"/{slug}/admin/caja", admin), "carta_admin": (f"/{slug}/admin/carta", admin),
        "inventario": (f"/{slug}/admin/inventario", admin), "pantalla": (f"/{slug}/pantalla", None),
    }
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--disable-dev-shm-usage", "--font-render-hinting=none"])
        try:
            for i, name in enumerate(dict.fromkeys(shots)):
                if name not in routes:
                    continue
                progress(f"Capturando «{SHOTS[name]['label']}» ({i + 1}/{len(set(shots))})")
                path, session = routes[name]
                ctx = browser.new_context(**DEVICES[SHOTS[name]["device"]], locale="es-CO", color_scheme="dark")
                page = ctx.new_page()
                page.goto(f"{INTERNAL}/creditos")
                page.evaluate("s => { localStorage.setItem('brindix.theme', JSON.stringify('dark'));"
                              " if (s) localStorage.setItem('brindix.session', JSON.stringify(s)); }", session)
                page.goto(f"{INTERNAL}{path}", wait_until="networkidle")
                page.add_style_tag(content=".toasts, bx-staff-alerts, .support-bar { display: none !important; } * { caret-color: transparent !important; }")
                if name == "musica":
                    page.evaluate("[...document.querySelectorAll('.tabbar button')].find(b => b.textContent.includes('Música'))?.click()")
                    page.wait_for_timeout(1500)
                if name == "pedido":
                    page.evaluate("document.querySelectorAll('.prod .plus')[0]?.click()")
                    page.wait_for_timeout(300)
                    page.evaluate("[...document.querySelectorAll('.qchip')].find(b => b.textContent.trim() === '6')?.click()")
                page.wait_for_timeout(1800)
                out[name] = "data:image/jpeg;base64," + base64.b64encode(page.screenshot(type="jpeg", quality=88)).decode()
                ctx.close()
        finally:
            browser.close()
    return out


# ---------------- Render ----------------

def render(stage_data: dict, size: tuple[int, int], total: float, video_path: str, poster_path: str, progress) -> None:
    """Graba el escenario cuadro por cuadro (window.stageAt(t)) y lo codifica en H.264."""
    from playwright.sync_api import sync_playwright

    w, h = size
    frames = int(total * FPS)
    stage = "file://" + os.path.join(os.path.dirname(__file__), "stage", "stage.html")
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS), video_path]
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--disable-dev-shm-usage", "--font-render-hinting=none"])
        try:
            page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            page.goto(stage)
            page.evaluate("d => window.load(d)", stage_data)
            page.wait_for_function("window.ready === true", timeout=60000)
            ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            started = time.time()
            for i in range(frames):
                page.evaluate(f"window.stageAt({i / FPS})")
                ff.stdin.write(page.screenshot(type="jpeg", quality=90))
                if i % (FPS * 2) == 0:
                    eta = (time.time() - started) / max(1, i) * (frames - i)
                    progress(f"Grabando el video {int(i / frames * 100)}% (faltan ~{int(eta)} s)", 40 + int(i / frames * 50))
            ff.stdin.close()
            if ff.wait() != 0:
                raise RuntimeError("ffmpeg no pudo armar el video")
            page.evaluate(f"window.stageAt({stage_data['posterAt']})")
            with open(poster_path, "wb") as f:
                f.write(page.screenshot(type="jpeg", quality=88))
        finally:
            browser.close()


def soundtrack(clips: list[tuple[str, float]], music_path: str | None, total: float, out_path: str) -> None:
    """Voz (cada escena en su segundo) + música de fondo baja que se apaga al final."""
    inputs, chains, labels = [], [], []
    for i, (path, at) in enumerate(clips):
        inputs += ["-i", path]
        chains.append(f"[{i}:a]aformat=channel_layouts=stereo,adelay={int(at * 1000)}|{int(at * 1000)}[v{i}]")
        labels.append(f"[v{i}]")
    chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,volume=1.6[voice]")
    mix = "[voice]"
    if music_path:
        inputs += ["-stream_loop", "-1", "-i", music_path]
        m = len(clips)
        chains.append(f"[{m}:a]volume=0.13,afade=t=in:d=1.5,afade=t=out:st={max(0, total - 2.5):.2f}:d=2.5[mus]")
        chains.append("[voice][mus]amix=inputs=2:normalize=0[mix]")
        mix = "[mix]"
    chains.append(f"{mix}atrim=0:{total:.2f},loudnorm=I=-16:TP=-1.5[out]")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains), "-map", "[out]",
                    "-c:a", "aac", "-b:a", "160k", out_path], check=True)


def mux(video: str, audio: str, out: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", video, "-i", audio, "-c:v", "copy", "-c:a", "copy",
                    "-shortest", "-movflags", "+faststart", out], check=True)


def qr(text: str) -> str:
    import qrcode
    img = qrcode.make(text, box_size=12, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def as_json(o) -> str:
    return json.dumps(o, ensure_ascii=False)
