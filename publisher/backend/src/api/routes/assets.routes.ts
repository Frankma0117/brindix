import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express, { type IRouter, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { AccessError } from '../../models/permissions.model.js';
import { ALLOWED_MIME, MAX_UPLOAD, addFromPath, assetView, deleteAsset, importFromUrl, listAssets, listPending, updateAsset, validateAsset } from '../../services/assets/assets.service.js';
import { postFromAsset, resolveMedia } from '../../services/publisher/publisher-media.js';
import { load, postView } from '../../services/publisher/publisher.service.js';
import { assetsStore } from '../../services/assets/assets.store.js';
import { handleApprovalDecision } from '../../services/publisher/automation/automation.service.js';
import { verifyCanixWebhook } from '../../services/publisher/canix-client.js';
import { h, str, userId } from '../http-helpers.js';
import { rateLimit } from '../security.js';

const UPLOAD_DIR = join(tmpdir(), 'publisher-uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: MAX_UPLOAD, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.includes(file.mimetype)),
});

/** Admin side: the library of files (upload, link, edit, delete). */
export function registerAssetsAdminRoutes(app: IRouter): void {
  app.get('/api/admin/assets', h((_req, res) => res.json({ assets: listAssets(), pending: listPending(), videos: assetsStore.availableVideos() })));

  /** «Por validar»: action = publish (approve it and open its publication), approve (library only) or discard. */
  app.post(
    '/api/admin/assets/:id/validate',
    h(async (req, res) => {
      const id = Number(req.params.id);
      const action = String(req.body?.action ?? '');
      if (!['publish', 'approve', 'discard'].includes(action)) throw new AccessError('Elige qué hacer con este video.');
      await validateAsset(id, action === 'discard' ? 'discard' : 'approve');
      if (action !== 'publish') return void res.json({ ok: true });
      const post = postFromAsset(userId(req), `a${id}`);
      res.json({ ok: true, post: postView(load(post.id), resolveMedia) });
    }),
  );

  app.post(
    '/api/admin/assets',
    (req: Request, res: Response, next: NextFunction) =>
      upload.single('file')(req, res, (err: unknown) => {
        if (err) return void res.status(400).json({ error: (err as { code?: string }).code === 'LIMIT_FILE_SIZE' ? 'El archivo es demasiado grande (máximo 300 MB).' : 'No se pudo recibir el archivo.' });
        next();
      }),
    h(async (req, res) => {
      if (!req.file) throw new AccessError('Elige un video (MP4, MOV, WEBM) o una imagen (JPG, PNG, WEBP).');
      res.json(assetView(await addFromPath(req.file.path, req.file.mimetype, { title: req.body?.title || req.file.originalname.replace(/\.[^.]+$/, ''), caption: req.body?.caption, source: 'upload' })));
    }),
  );

  app.post('/api/admin/assets/import', h(async (req, res) => res.json(assetView(await importFromUrl(str(req.body?.url, 800) ?? '', { title: req.body?.title, caption: req.body?.caption, source: 'url' })))));
  app.put('/api/admin/assets/:id', h((req, res) => (updateAsset(Number(req.params.id), req.body?.title, req.body?.caption), res.json({ ok: true }))));
  app.delete('/api/admin/assets/:id', h(async (req, res) => (await deleteAsset(Number(req.params.id)), res.json({ ok: true }))));
}

/** The project's own software pushes files here (Authorization: Bearer PUBLISHER_API_KEY). */
export function registerAssetsApi(app: IRouter): void {
  const limit = rateLimit({ capacity: 60, windowMs: 60_000, keyFn: (req) => (req.header('authorization') ?? req.ip ?? 'anon').slice(0, 40) });
  const auth = (req: Request, res: Response, next: NextFunction) => {
    const key = process.env.PUBLISHER_API_KEY?.trim();
    const given = /^Bearer\s+(\S+)$/.exec(req.header('authorization') ?? '')?.[1] ?? '';
    const ok = !!key && timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(key).digest());
    if (!ok) return void res.status(401).json({ error: 'Llave de API no válida.' });
    next();
  };
  /** { url (https), title?, caption?, ref?, thumbnailUrl?, status? } → the file is downloaded. status = pending (default: the administrator validates it in «Por validar») or approved (straight to the library). Same `ref` twice = same file. */
  app.post('/api/v1/assets', limit, auth, h(async (req, res) => res.status(201).json(assetView(await importFromUrl(str(req.body?.url, 800) ?? '', { title: req.body?.title, caption: req.body?.caption, ref: req.body?.ref, thumbnailUrl: req.body?.thumbnailUrl, status: req.body?.status === 'approved' ? 'approved' : 'pending', source: 'api' })))));
}

/** Canix tells this app what the administrator answered (👍 / 👎 / link). Registered BEFORE express.json(): it needs the raw body. */
export function registerCanixWebhook(app: IRouter): void {
  app.post('/api/canix/webhook', express.raw({ type: 'application/json', limit: '20kb' }), (req: Request, res: Response) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!env.canix.webhookSecret || !verifyCanixWebhook(env.canix.webhookSecret, req.headers, raw)) return void res.sendStatus(401);
    let data: { ref?: string; status?: 'approved' | 'rejected' | 'expired' };
    try {
      data = JSON.parse(raw);
    } catch {
      return void res.sendStatus(400);
    }
    if (!data.ref || !data.status) return void res.sendStatus(400);
    handleApprovalDecision(data.ref, data.status).then(
      () => res.sendStatus(200),
      (err: Error) => {
        console.error('[CANIX] Webhook failed:', err.message);
        res.sendStatus(500);
      },
    );
  });
}
