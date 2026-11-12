#!/usr/bin/env python3
"""
Imágenes de prueba (una sola vez) para un bar: genera una foto por producto y por banner con
fal.ai (FLUX schnell, la misma cuenta de Aula Interactiva), la sube por la API de Brindix
(que la guarda en DigitalOcean Spaces) y la asigna. Salta lo que ya tiene imagen.

Uso en el servidor:
  cd /opt/brindix && python3 scripts/seed-images.py --venue demo --user admin --password '...'
Lee FAL_KEY del .env. Opcional: --base http://127.0.0.1:5710  --force (regenera todo)
"""
import argparse, json, os, sys, time, uuid, urllib.request, urllib.error

STYLE = ("professional commercial photograph for a bar menu, dark moody bar counter, warm amber light, "
         "soft pink and teal neon bokeh in the background, shallow depth of field, appetizing, high detail, "
         "no text, no letters, no logos, no watermark, no people")


def env(key):
    for path in (".env", "/opt/brindix/.env"):
        if os.path.exists(path):
            for line in open(path, encoding="utf-8"):
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip()
    return os.environ.get(key, "")


def http(method, url, body=None, headers=None, raw=False, timeout=120):
    data = None
    h = dict(headers or {})
    if body is not None and not isinstance(body, bytes):
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    elif isinstance(body, bytes):
        data = body
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        content = r.read()
        return content if raw else (json.loads(content) if content else None)


def fal_image(key, prompt, size):
    res = http("POST", "https://fal.run/fal-ai/flux/schnell",
               {"prompt": prompt, "image_size": size, "num_inference_steps": 4, "num_images": 1, "enable_safety_checker": True},
               {"Authorization": "Key " + key}, timeout=180)
    return http("GET", res["images"][0]["url"], raw=True)


def upload(base, token, data, folder):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"img.jpg\"\r\n"
            f"Content-Type: image/jpeg\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    return http("POST", f"{base}/api/admin/uploads?folder={folder}", body,
                {"Authorization": "Bearer " + token, "Content-Type": f"multipart/form-data; boundary={boundary}"})["url"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--venue", default="demo")
    ap.add_argument("--user", default="admin")
    ap.add_argument("--password", required=True)
    ap.add_argument("--base", default="http://127.0.0.1:" + (env("BRINDIX_PORT") or "5710"))
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    fal = env("FAL_KEY")
    if not fal:
        sys.exit("Falta FAL_KEY en el .env")
    token = http("POST", a.base + "/api/auth/login", {"venue": a.venue, "username": a.user, "password": a.password})["token"]
    auth = {"Authorization": "Bearer " + token}

    products = http("GET", a.base + "/api/admin/products", headers=auth)
    done = 0
    for p in products:
        if p.get("imageUrl") and not a.force:
            continue
        what = f"{p['name']}" + (f" ({p['description']})" if p.get("description") else "")
        prompt = f"{what}, served in a bar, centered, {STYLE}"
        try:
            img = fal_image(fal, prompt, "square_hd")
            url = upload(a.base, token, img, "products")
            http("PATCH", f"{a.base}/api/admin/products/{p['id']}", {"imageUrl": url}, auth)
            done += 1
            print(f"✓ {p['name']}")
        except urllib.error.HTTPError as e:
            print(f"✗ {p['name']}: {e.code} {e.read()[:200]}")
        time.sleep(0.5)

    banners = http("GET", a.base + "/api/admin/banners", headers=auth)
    for b in banners:
        if b.get("imageUrl") and not a.force:
            continue
        prompt = f"wide banner photo for a bar promotion about '{b['title']}': {b.get('subtitle') or ''}, cocktails and beers on a table, party mood, {STYLE}"
        try:
            img = fal_image(fal, prompt, "landscape_16_9")
            url = upload(a.base, token, img, "banners")
            body = {k: b.get(k) for k in ("title", "subtitle", "theme", "durationSeconds", "sortOrder", "active", "startsAt", "endsAt", "productId")}
            body["imageUrl"] = url
            http("PUT", f"{a.base}/api/admin/banners/{b['id']}", body, auth)
            done += 1
            print(f"✓ banner {b['title']}")
        except urllib.error.HTTPError as e:
            print(f"✗ banner {b['title']}: {e.code} {e.read()[:200]}")
    print(f"Listo: {done} imágenes nuevas.")


if __name__ == "__main__":
    main()
