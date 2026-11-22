// Capturas reales de la app Brindix (solo lectura) para escenas de video.
// Uso (en el servidor): source tools/env.sh; set -a; . /opt/brindix/.env; node tools/capturas-brindix.mjs [nombre ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
const B = process.env.BX_URL || 'http://127.0.0.1:5710';
const SLUG = process.env.STUDIO_VENUE || 'demo';
const OUT = '/opt/videos/taller/public/proyectos/brindix/capturas';
const only = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

async function login(user, pass) {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ venue: SLUG, username: user, password: pass }) });
  if (!r.ok) throw new Error('login ' + user + ' ' + r.status);
  return r.json();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
async function ctx(session) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, userAgent: UA, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'es-CO' });
  await c.addInitScript(([s]) => {
    try { localStorage.setItem('brindix.theme', 'light'); if (s) localStorage.setItem('brindix.session', JSON.stringify(s)); } catch {}
  }, [session]);
  return c;
}
async function shot(page, name, path, prep) {
  if (only.length && !only.includes(name)) return;
  await page.goto(B + path, { waitUntil: 'networkidle' });
  await wait(1200);
  if (prep) await prep(page);
  // la URL local de los QR no se muestra en el video
  await page.evaluate(() => document.querySelectorAll('a,span,small,div,p').forEach((e) => { if (!e.children.length && /127\.0\.0\.1/.test(e.textContent || '')) e.style.visibility = 'hidden'; })).catch(() => {});
  await page.addStyleTag({ content: '[class*="toast"],[class*="cookie"]{display:none!important}' }).catch(() => {});
  await wait(600);
  const file = OUT + '/' + name + '.jpg';
  await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  console.log('ok', name, fs.statSync(file).size);
}

const admin = await login(process.env.STUDIO_ADMIN_USER, process.env.STUDIO_ADMIN_PASS);
const waiter = await login(process.env.STUDIO_WAITER_USER, process.env.STUDIO_WAITER_PASS);
const tables = await (await fetch(B + '/api/admin/tables', { headers: { authorization: 'Bearer ' + admin.token } })).json();
const code = tables[0].code;

// cliente (sin sesión)
{
  const c = await ctx(null); const p = await c.newPage();
  await shot(p, 'cliente-carta', `/${SLUG}/m/${code}`);
  // el pedido vive solo en el navegador (localStorage); no se envía nada
  await p.addInitScript(([k]) => { try { localStorage.setItem(k, JSON.stringify([{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }, { id: 3, quantity: 1 }])); } catch {} }, [`brindix.cart.${SLUG}.${code}`]);
  await shot(p, 'cliente-carrito', `/${SLUG}/m/${code}`, async (pg) => { await pg.locator('.cart-fab').click(); await wait(900); });
  await c.close();
}
// mesero
{
  const c = await ctx(waiter); const p = await c.newPage();
  await shot(p, 'mesero-mesas', `/${SLUG}/mesero`);
  if (!only.length || only.includes('mesero-cuenta')) {
    await shot(p, 'mesero-cuenta', `/${SLUG}/mesero`, async (pg) => { await pg.getByText('Mesa 1', { exact: true }).first().click(); await pg.waitForURL(/cuenta/); await pg.waitForLoadState('networkidle'); await wait(1200); });
  }
  await c.close();
}
// admin
{
  const c = await ctx(admin); const p = await c.newPage();
  for (const [n, r] of [['admin-resumen', ''], ['admin-carta', '/carta'], ['admin-mesas-qr', '/mesas'], ['admin-ventas', '/ventas'], ['admin-caja', '/caja'], ['admin-inventario', '/inventario']])
    await shot(p, n, `/${SLUG}/admin${r}`, n === 'admin-ventas' ? async (pg) => { await pg.getByRole('button', { name: '30 días' }).click(); await wait(1500); } : undefined);
  await c.close();
}
await browser.close();
