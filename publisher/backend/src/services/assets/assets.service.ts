import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AccessError } from '../../models/permissions.model.js';
import { deleteFolder, publicUrl, putFile, putFileFromPath, usesSpaces } from '../storage.js';
import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';
import { publisherHost } from '../publisher/automation/automation.host.js';
import { assetsStore, type Asset } from './assets.store.js';

/**
 * The library of files the project publishes. They come from the panel (upload), from a link, or
 * pushed by the project's own software through POST /api/v1/assets (e.g. Brindix sends the videos its studio makes).
 */
const MAX_BYTES = { video: 300 * 1024 * 1024, image: 15 * 1024 * 1024 };
const TYPES: Record<string, { media: 'image' | 'video'; ext: string }> = {
  'video/mp4': { media: 'video', ext: 'mp4' },
  'video/quicktime': { media: 'video', ext: 'mov' },
  'video/webm': { media: 'video', ext: 'webm' },
  'image/jpeg': { media: 'image', ext: 'jpg' },
  'image/png': { media: 'image', ext: 'png' },
  'image/webp': { media: 'image', ext: 'webp' },
};
export const ALLOWED_MIME = Object.keys(TYPES);
export const MAX_UPLOAD = MAX_BYTES.video;

export function assetView(a: Asset) {
  return {
    id: a.id,
    media: a.media,
    title: a.title,
    caption: a.caption,
    url: publicUrl(a.file_ref),
    thumbUrl: publicUrl(a.thumb_ref),
    source: a.source,
    status: a.status,
    ref: a.ref,
    usedCount: a.used_count,
    createdAt: `${a.created_at.replace(' ', 'T')}Z`,
  };
}

export const listAssets = () => assetsStore.list().map(assetView);
export const listPending = () => assetsStore.pending().map(assetView);

/** «local:asset-ab12/name.mp4» → «asset-ab12» (the folder that holds the file). */
function folderOfRef(ref: string): string {
  const path = ref.startsWith('local:') ? ref.slice(6) : ref.replace(env.spaces.prefix, '');
  return path.split('/')[0];
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** A file already on disk (the path is removed afterwards). */
export async function addFromPath(path: string, mime: string, meta: { title?: unknown; caption?: unknown; source: Asset['source']; ref?: unknown; status?: Asset['status']; thumbnailUrl?: unknown }): Promise<Asset> {
  const type = TYPES[mime.split(';')[0].trim().toLowerCase()];
  if (!type) {
    rmSync(path, { force: true });
    throw new AccessError('Ese tipo de archivo no sirve. Sube MP4, MOV o WEBM (video) o JPG, PNG o WEBP (imagen).');
  }
  const ref = clean(meta.ref, 200);
  const existing = assetsStore.byRef(ref);
  if (existing) {
    rmSync(path, { force: true });
    return existing; // pushing the same ref again doesn't duplicate
  }
  const folder = `asset-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const fileRef = await putFileFromPath(folder, `file.${type.ext}`, path, mime.split(';')[0].trim());
  const id = assetsStore.create({ media: type.media, title: clean(meta.title, 120) || 'Sin título', caption: clean(meta.caption, 2000), fileRef, source: meta.source, ref, status: meta.status });
  const thumbnailUrl = clean(meta.thumbnailUrl, 500);
  if (thumbnailUrl) await attachThumb(id, folder, thumbnailUrl).catch((err: Error) => console.log('[ASSETS] Thumbnail skipped:', err.message));
  const asset = assetsStore.get(id)!;
  if (asset.status === 'pending') void publisherHost().notify(`🎬 ${env.projectName} tiene un video nuevo por validar: «${asset.title}». Entra al publicador y elige si se publica.`).catch(() => {});
  return asset;
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.');
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** An https address that points to the public internet (never to this machine's own network). */
async function assertPublicUrl(url: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new AccessError('Esa dirección no es válida.');
  }
  if (u.protocol !== 'https:') throw new AccessError('La dirección debe ser https.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new AccessError('No se pudo encontrar esa dirección.');
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new AccessError('Esa dirección no está permitida.');
  return u;
}

/** The cover of a video sent by the project (an image at an https address, up to 5 MB). Best effort. */
async function attachThumb(id: number, folder: string, url: string): Promise<void> {
  const u = await assertPublicUrl(url);
  const res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const type = TYPES[mime];
  if (!res.ok || type?.media !== 'image') throw new Error('not an image');
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) throw new Error('too big');
  assetsStore.setThumb(id, await putFile(folder, `thumb.${type.ext}`, bytes, mime));
}

/** Downloads a file from an https link (never from this machine's own network) and adds it to the library. */
export async function importFromUrl(url: string, meta: { title?: unknown; caption?: unknown; ref?: unknown; source: 'url' | 'api'; status?: Asset['status']; thumbnailUrl?: unknown }): Promise<Asset> {
  const u = await assertPublicUrl(url);

  const res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(10 * 60_000) }).catch(() => null);
  if (!res?.ok || !res.body) throw new AccessError('No se pudo descargar el archivo de esa dirección.');
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const type = TYPES[mime];
  if (!type) throw new AccessError('Ese enlace no es un video (MP4, MOV, WEBM) ni una imagen (JPG, PNG, WEBP).');
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES[type.media]) throw new AccessError('El archivo es demasiado grande.');

  const dir = mkdtempSync(join(tmpdir(), 'publisher-'));
  const path = join(dir, `download.${type.ext}`);
  const limiter = new TransformCounter(MAX_BYTES[type.media]);
  try {
    await pipeline(Readable.fromWeb(res.body as never), limiter, createWriteStream(path));
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err instanceof AccessError ? err : new AccessError('No se pudo descargar el archivo.');
  }
  try {
    return await addFromPath(path, mime, meta);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Counts the bytes going through and stops the download when it passes the limit. */
class TransformCounter extends Transform {
  private n = 0;
  constructor(private max: number) {
    super();
  }
  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null, data?: Buffer) => void): void {
    this.n += chunk.length;
    if (this.n > this.max) return cb(new AccessError('El archivo es demasiado grande.'));
    cb(null, chunk);
  }
}

/** Tells the project's software what the administrator chose (signed with EMBED_SECRET). Best effort. */
async function notifyProject(a: Asset, status: 'approved' | 'rejected'): Promise<void> {
  if (!env.projectWebhookUrl) return;
  const body = JSON.stringify({ event: 'asset.validated', ref: a.ref, status, id: a.id, project: env.projectName });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = `sha256=${createHmac('sha256', env.embedSecret).update(`${ts}.${body}`).digest('hex')}`;
  await fetch(env.projectWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Publisher-Timestamp': ts, 'X-Publisher-Signature': sig }, body, signal: AbortSignal.timeout(10_000) }).catch((err: Error) => console.log('[ASSETS] Project webhook failed:', err.message));
}

/** «Por validar»: approve it (it joins the library) or discard it (its file is deleted; the ref stays so it isn't sent again). */
export async function validateAsset(id: number, action: 'approve' | 'discard'): Promise<Asset> {
  const a = assetsStore.get(id);
  if (!a) throw new AccessError('Ese archivo ya no existe.');
  if (a.status !== 'pending') throw new AccessError('Ese archivo ya se validó.');
  if (action === 'approve') assetsStore.setStatus(id, 'approved');
  else {
    assetsStore.setStatus(id, 'rejected');
    await deleteFolder(folderOfRef(a.file_ref));
  }
  void notifyProject(a, action === 'approve' ? 'approved' : 'rejected');
  return assetsStore.get(id)!;
}

export function updateAsset(id: number, title: unknown, caption: unknown): void {
  const a = assetsStore.get(id);
  if (!a) throw new AccessError('Ese archivo ya no existe.');
  assetsStore.update(id, clean(title, 120) || a.title, clean(caption, 2000));
}

export async function deleteAsset(id: number): Promise<void> {
  const a = assetsStore.get(id);
  if (!a) throw new AccessError('Ese archivo ya no existe.');
  assetsStore.delete(id);
  await deleteFolder(folderOfRef(a.file_ref));
}

export { usesSpaces };
