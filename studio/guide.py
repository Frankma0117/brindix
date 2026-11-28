"""Guía en PDF paso a paso: una página por escena con la captura, los recuadros numerados y su explicación."""
import html
import os
import tempfile


def _e(s) -> str:
    return html.escape(str(s or ""))


def _page(i: int, sc: dict, img: str | None) -> str:
    marks = "".join(
        f'<i class="mk" style="left:{float(c.get("x", 50))}%;top:{float(c.get("y", 50))}%">{n}</i>'
        for n, c in enumerate(sc.get("callouts") or [], 1))
    items = "".join(f"<li><b>{n}</b><span>{_e(c.get('text'))}</span></li>" for n, c in enumerate(sc.get("callouts") or [], 1))
    shot = f'<div class="phone"><img src="data:image/jpeg;base64,{img}">{marks}</div>' if img else '<div class="phone"></div>'
    return (f'<section class="pg"><p class="step">Paso {i}</p><h2>{_e(sc.get("title"))}</h2><p class="sub">{_e(sc.get("sub"))}</p>'
            f'<div class="body">{shot}<ol>{items}</ol></div></section>')


def build(spec: dict, images: dict[str, str]) -> bytes:
    from playwright.sync_api import sync_playwright

    brand = spec.get("brand") or {}
    c1, c2, c3 = brand.get("from", "#ffb238"), brand.get("mid", "#ff7a45"), brand.get("to", "#ff4f8b")
    intro, outro = spec.get("intro") or {}, spec.get("outro") or {}
    pages = [_page(i, sc, images.get(sc.get("image"))) for i, sc in enumerate(spec.get("scenes") or [], 1)]
    doc = f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>
@page {{ size: A4; margin: 0 }}
* {{ box-sizing: border-box; margin: 0 }}
body {{ font-family: 'DejaVu Sans', Arial, sans-serif; color: #1c1612 }}
.pg, .cover {{ width: 210mm; height: 297mm; padding: 16mm 16mm; page-break-after: always; position: relative; overflow: hidden }}
.cover {{ background: linear-gradient(150deg, {c1}, {c2} 55%, {c3}); color: #fff; display: flex; flex-direction: column; justify-content: center }}
.cover h1 {{ font-size: 54pt; letter-spacing: -1px }} .cover p {{ font-size: 18pt; margin-top: 8mm; max-width: 140mm }}
.cover small {{ position: absolute; bottom: 16mm; font-size: 11pt; opacity: .9 }}
.step {{ color: {c2}; font-weight: 700; font-size: 11pt; text-transform: uppercase; letter-spacing: 1.5px }}
h2 {{ font-size: 22pt; margin-top: 2mm }} .sub {{ font-size: 12pt; color: #6b5f55; margin: 2mm 0 7mm }}
.body {{ display: flex; gap: 10mm; align-items: flex-start }}
.phone {{ position: relative; width: 78mm; flex: none; border: 2.2mm solid #1c1612; border-radius: 9mm; overflow: hidden; line-height: 0 }}
.phone img {{ width: 100%; display: block }}
.mk {{ position: absolute; transform: translate(-50%,-50%); width: 8mm; height: 8mm; border-radius: 50%; background: {c2}; color: #fff;
  font: 700 11pt/8mm Arial, sans-serif; text-align: center; border: .6mm solid #fff; font-style: normal; box-shadow: 0 0 0 1mm {c2}55 }}
ol {{ list-style: none; padding: 0; flex: 1; padding-top: 6mm }}
li {{ display: flex; gap: 4mm; align-items: flex-start; margin-bottom: 7mm; font-size: 13pt; line-height: 1.35 }}
li b {{ flex: none; width: 8mm; height: 8mm; border-radius: 50%; background: {c2}; color: #fff; text-align: center; line-height: 8mm; font-size: 11pt }}
.pg.end {{ display: flex; flex-direction: column; justify-content: center; text-align: center }} .pg.end h2 {{ font-size: 28pt }} .pg.end .sub {{ font-size: 16pt }}
</style><body>
<section class="cover"><h1>{_e(intro.get('title') or brand.get('name'))}</h1><p>{_e(intro.get('sub'))}</p><small>Guía paso a paso · brindix.cania.app</small></section>
{''.join(pages)}
<section class="pg end"><h2>{_e(outro.get('title'))}</h2><p class="sub">{_e(outro.get('cta'))}</p></section>
</body></html>"""
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "guia.html")
        with open(src, "w", encoding="utf8") as f:
            f.write(doc)
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--disable-dev-shm-usage"])
            try:
                page = browser.new_page()
                page.goto("file://" + src)
                return page.pdf(width="210mm", height="297mm", print_background=True, prefer_css_page_size=True)
            finally:
                browser.close()
