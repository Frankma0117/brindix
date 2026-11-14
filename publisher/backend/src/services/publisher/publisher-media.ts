import { env } from '../../config/env.js';
import { AccessError } from '../../models/permissions.model.js';
import { assetsStore } from '../assets/assets.store.js';
import { deleteFolder, publicUrl, putFile, readFile } from '../storage.js';
import { studioStore } from './studio/studio.store.js';
import type { MediaAccess } from './publisher.types.js';
import { createPost } from './publisher.service.js';
import { publisherStore } from './publisher.store.js';
import { normalizeHashtags } from './publisher-seo.js';

/**
 * The only file of the publisher that knows where the media comes from. In this app it comes from
 * two places: the library of files (uploaded, imported from a link, or pushed by the project's
 * software - services/assets/) and the brand studio's designs (services/publisher/studio/).
 */

/** A stored reference → a URL the browser can fetch (relative when it lives on this server). */
export const resolveMedia = (ref: string): string => publicUrl(ref);

/** What the publisher uses to reach the media: its absolute URL (the networks download it), or its bytes. */
export const mediaAccess: MediaAccess = {
  url: (ref) => {
    const url = resolveMedia(ref);
    return url.startsWith('/') ? `${env.panelUrl}${url}` : url;
  },
  read: (ref) => readFile(ref),
};

/** Material ready to publish: library files («a12») and approved studio designs («d5»). */
export function approvedAssets() {
  const library = assetsStore.list().map((a) => ({ id: `a${a.id}`, source: 'library' as const, media: a.media, title: a.title, caption: a.caption, url: resolveMedia(a.file_ref), poster: resolveMedia(a.thumb_ref || (a.media === 'image' ? a.file_ref : '')) }));
  const designs = studioStore
    .approved()
    .filter((d) => d.kind !== 'logo' && d.kind !== 'profile' && d.kind !== 'cover')
    .map((d) => ({ id: `d${d.id}`, source: 'studio' as const, media: 'image' as const, title: d.title, caption: d.caption, url: resolveMedia(d.file_ref), poster: resolveMedia(d.file_ref) }));
  return [...designs, ...library];
}

export function postFromAsset(userId: number | null, assetId: string, extra: { keywords?: string[]; hashtags?: string[] } = {}) {
  const m = /^([ad])(\d+)$/.exec(assetId);
  if (!m) throw new AccessError('Elige el video o la imagen que quieres publicar.');
  const id = Number(m[2]);
  const common = { keywords: extra.keywords ?? [], hashtags: normalizeHashtags(extra.hashtags ?? [], 30) };
  if (m[1] === 'd') {
    const d = studioStore.get(id);
    if (!d || d.status !== 'approved' || !d.file_ref) throw new AccessError('Ese diseño todavía no está aprobado.');
    return createPost(userId, { mediaType: 'image', mediaRef: d.file_ref, thumbnailRef: d.file_ref, title: d.title || 'Sin título', description: d.caption, ...common });
  }
  const a = assetsStore.get(id);
  if (!a || a.archived) throw new AccessError('Ese archivo ya no existe.');
  return createPost(userId, { mediaType: a.media, mediaRef: a.file_ref, thumbnailRef: a.thumb_ref || (a.media === 'image' ? a.file_ref : ''), title: a.title || 'Sin título', description: a.caption, ...common });
}

// ---------- budget (only the AI art of the studio costs money) ----------

const DEFAULT_CAP = 30;

export function generationCap(): number {
  const n = Number(publisherStore.getSetting('generation_cap'));
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : DEFAULT_CAP;
}

export function setGenerationCap(n: number): void {
  if (!Number.isFinite(n) || n < 0 || n > 10_000) throw new AccessError('El tope mensual no es válido.');
  publisherStore.setSetting('generation_cap', String(Math.trunc(n)));
}

export const usedThisMonth = (): number => studioStore.aiThisMonth();

export function ensureBudget(wanted: number): void {
  const cap = generationCap();
  const used = usedThisMonth();
  if (used + wanted > cap) throw new AccessError(`Con esto pasarías el tope de ${cap} piezas al mes (llevas ${used}). Súbelo en los ajustes si lo necesitas.`);
}

// ---------- files of the brand studio ----------

export const storeStudioFile = (designId: number, name: string, data: Buffer, mime: string): Promise<string> => putFile(`studio-${designId}`, name, data, mime);
export const readStudioFile = (ref: string): Promise<Buffer | null> => readFile(ref);
export const deleteStudioFiles = (designId: number): Promise<void> => deleteFolder(`studio-${designId}`);
