import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import express, { Router, type Express, type NextFunction, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { PUBLIC_DIR } from '../config/paths.js';
import { LOCAL_DIR } from '../services/storage.js';
import { clearSessionCookie, cookieToken, login, logout, requireAdmin, sessionFromTicket, sessionToken, setSessionCookie, validSession } from './auth.js';
import { redeemTicket } from './embed.js';
import { registerAssetsAdminRoutes, registerAssetsApi, registerCanixWebhook } from './routes/assets.routes.js';
import { registerPublisherPublicRoutes, registerPublisherRoutes } from './routes/publisher.routes.js';
import { rateLimit, securityHeaders } from './security.js';

/** The panel's page with the runtime settings (base path, embedded mode) injected before the scripts. */
function panelHtml(): string | null {
  const file = join(PUBLIC_DIR, 'index.html');
  if (!existsSync(file)) return null;
  const settings = JSON.stringify({ base: env.basePath, embedded: env.embedded, returnUrl: env.returnUrl }).replace(/</g, '\\u003c');
  return readFileSync(file, 'utf8').replace('</head>', `<script>window.__APP__=${settings}</script></head>`);
}

/**
 * Everything is mounted under BASE_PATH (empty by default) so the app can live inside a project's own
 * domain, behind its nginx, as a section of its panel (e.g. /publicador).
 */
export function createServer(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);

  const r = Router();
  r.get('/api/health', (_req, res) => res.json({ ok: true }));
  registerCanixWebhook(r); // needs the raw body: before express.json()

  r.use('/api', rateLimit({ capacity: 240, windowMs: 60_000 }));
  r.use(express.json({ limit: '200kb' }));

  // The files to publish. Public on purpose: Meta, TikTok... download the media from here.
  r.use('/files', express.static(LOCAL_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }));
  r.use('/files', (_req, res) => void res.sendStatus(404)); // a missing file is a 404, never the panel's page

  registerPublisherPublicRoutes(r); // where the networks' login returns (one-use state)
  registerAssetsApi(r);

  r.get('/api/config', (_req, res) => res.json({ name: env.projectName, embedded: env.embedded, returnUrl: env.returnUrl }));

  // Embedded: the project's panel sends the administrator here with a signed ticket.
  r.get('/sso', rateLimit({ capacity: 20, windowMs: 10 * 60_000 }), (req, res) => {
    if (!env.embedded || !redeemTicket(env.embedSecret, String(req.query.ticket ?? ''))) {
      res.status(401).type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center"><h1>Enlace vencido</h1><p>Vuelve al panel y abre el publicador de nuevo.</p><p><a href="${env.returnUrl.replace(/"/g, '')}">Volver al panel</a></p>`);
      return;
    }
    setSessionCookie(res, sessionFromTicket());
    res.redirect(303, `${env.basePath}/`);
  });

  r.post('/api/auth/login', rateLimit({ capacity: 8, windowMs: 15 * 60_000, message: 'Demasiados intentos. Espera unos minutos.' }), (req, res) => {
    const token = login(String(req.body?.password ?? ''));
    if (!token) return void res.status(env.embedded ? 404 : 401).json({ error: env.embedded ? 'No encontrado.' : 'Contraseña incorrecta.' });
    res.json({ token });
  });
  r.post('/api/auth/logout', (req, res) => {
    const token = sessionToken(req);
    if (token) logout(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  r.get('/api/auth/me', requireAdmin, (_req, res) => res.json({ ok: true }));

  r.use('/api/admin', requireAdmin);
  registerPublisherRoutes(r);
  registerAssetsAdminRoutes(r);

  r.use('/api', (_req, res) => void res.status(404).json({ error: 'No encontrado.' }));

  // The panel (built by `npm run build`).
  if (existsSync(PUBLIC_DIR)) {
    r.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));
    const page = (_req: Request, res: Response) => {
      const html = panelHtml();
      if (!html) return void res.sendStatus(404);
      res.type('html').set('Cache-Control', 'no-store').send(html);
    };
    r.get('/', page);
    r.get('/{*splat}', page);
  }

  app.use(env.basePath || '/', r);
  if (env.basePath) app.get('/', (_req, res) => res.redirect(`${env.basePath}/`));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API] Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Ocurrió un error. Inténtalo de nuevo.' });
  });
  void validSession;
  void cookieToken;
  return app;
}
