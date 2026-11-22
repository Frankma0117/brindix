// Puente del taller de video (Remotion) para el backend de Brindix, que vive en Docker.
// Corre en el host como servicio de usuario (systemd --user) y NO se expone a internet: escucha solo en
// la IP del bridge de Docker y exige un token. Renderiza de a un video, con nice/ionice.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const TALLER = process.env.VIDEO_TALLER_DIR || '/opt/videos/taller';
const OUT = process.env.VIDEO_OUT_DIR || '/opt/videos/out';
const TMP = process.env.VIDEO_TMP_DIR || '/opt/videos/tmp';
const HOST = process.env.BRIDGE_HOST || '172.17.0.1';
const PORT = Number(process.env.BRIDGE_PORT || 5720);
const TOKEN = process.env.BRIDGE_TOKEN || readFileSync(process.env.BRIDGE_TOKEN_FILE || '/opt/videos/bridge.token', 'utf8').trim();
const PROJECT = 'brindix';
const ASSET = new RegExp(`^proyectos/${PROJECT}/[A-Za-z0-9_./-]+\\.(png|jpe?g|webp)$`);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
if (!TOKEN || TOKEN.length < 24) throw new Error('BRIDGE_TOKEN demasiado corto');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

/** @type {Map<string,{state:'queued'|'rendering'|'done'|'error',detail:string}>} */
const jobs = new Map();
const queue = [];
let busy = false;

const fileOf = (id) => join(OUT, `brindix-${id}.mp4`);

function specAssetsOk(spec) {
  const paths = [spec?.brand?.logo, ...(spec?.scenes ?? []).map((s) => s?.image)];
  if (spec?.brand?.mascot && spec.brand.mascot !== 'brindix') paths.push(spec.brand.mascot);
  return paths.filter(Boolean).every((p) => typeof p === 'string' && ASSET.test(p) && !p.includes('..') && existsSync(join(TALLER, 'public', p)));
}

const previews = new Set();

function pump() {
  if (busy) return;
  const id = queue.shift();
  if (!id) return;
  busy = true;
  jobs.set(id, { state: 'rendering', detail: '' });
  const props = join(TMP, `brindix-${id}.json`);
  const cmd = `source tools/env.sh && nice -n 19 ionice -c3 npx remotion render src/index.ts Promo "${fileOf(id)}" --props="${props}" --concurrency=1 --log=error${previews.has(id) ? ' --scale=0.5 --crf=32' : ''}`;
  let err = '';
  const child = spawn('bash', ['-c', cmd], { cwd: TALLER, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
  const finish = (ok, detail) => {
    rmSync(props, { force: true });
    previews.delete(id);
    jobs.set(id, ok ? { state: 'done', detail: '' } : { state: 'error', detail });
    busy = false;
    pump();
  };
  child.on('error', (e) => finish(false, String(e.message)));
  child.on('close', (code) => finish(code === 0 && existsSync(fileOf(id)), err.trim() || `El grabador terminó con código ${code}.`));
}

function listAssets() {
  const base = join(TALLER, 'public', 'proyectos', PROJECT);
  const out = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (ASSET.test(r)) out.push({ path: r });
    }
  };
  walk(base, `proyectos/${PROJECT}`);
  return out;
}

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on('data', (c) => { n += c.length; if (n > 1_000_000) { reject(new Error('cuerpo muy grande')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

createServer(async (req, res) => {
  try {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { error: 'no autorizado' });
    const p = new URL(req.url ?? '/', 'http://x').pathname;
    if (req.method === 'GET' && p === '/health') return json(res, 200, { ok: true, busy, queued: queue.length });
    if (req.method === 'GET' && p === '/assets') return json(res, 200, { assets: listAssets() });
    if (req.method === 'GET' && p.startsWith('/asset/')) {
      const rel = decodeURIComponent(p.slice('/asset/'.length));
      if (!ASSET.test(rel) || rel.includes('..')) return json(res, 400, { error: 'ruta inválida' });
      const f = join(TALLER, 'public', rel);
      if (!existsSync(f)) return json(res, 404, { error: 'no existe' });
      res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'private, max-age=300' });
      return createReadStream(f).pipe(res);
    }
    let m = p.match(/^\/render\/([0-9]{1,12})$/);
    if (req.method === 'POST' && m) {
      const id = m[1];
      if (jobs.get(id)?.state === 'rendering' || queue.includes(id)) return json(res, 409, { error: 'ya se está grabando' });
      const spec = JSON.parse(await readBody(req));
      if (!specAssetsOk(spec)) return json(res, 400, { error: 'imágenes fuera de proyectos/brindix o inexistentes' });
      writeFileSync(join(TMP, `brindix-${id}.json`), JSON.stringify(spec));
      rmSync(fileOf(id), { force: true });
      if (new URL(req.url, 'http://x').searchParams.get('preview') === '1') previews.add(id); else previews.delete(id);
      jobs.set(id, { state: 'queued', detail: '' });
      queue.push(id);
      pump();
      return json(res, 202, { state: 'queued' });
    }
    m = p.match(/^\/(status|file)\/([0-9]{1,12})$/);
    if (m) {
      const id = m[2];
      if (req.method === 'GET' && m[1] === 'status') {
        const j = jobs.get(id) ?? (existsSync(fileOf(id)) ? { state: 'done', detail: '' } : { state: 'error', detail: 'No hay registro de la grabación (se reinició el servicio).' });
        return json(res, 200, j);
      }
      if (m[1] === 'file' && req.method === 'DELETE') {
        rmSync(fileOf(id), { force: true });
        jobs.delete(id);
        return json(res, 200, { ok: true });
      }
      if (m[1] === 'file' && req.method === 'GET') {
        if (!existsSync(fileOf(id))) return json(res, 404, { error: 'no existe' });
        res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': statSync(fileOf(id)).size });
        return createReadStream(fileOf(id)).pipe(res);
      }
    }
    json(res, 404, { error: 'no encontrado' });
  } catch (e) {
    json(res, 400, { error: String(e?.message ?? e) });
  }
}).listen(PORT, HOST, () => console.log(`video-bridge en ${HOST}:${PORT}`));
