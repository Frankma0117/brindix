import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { fromRoot } from '../config/paths.js';
import { db } from '../database/connection.js';

/**
 * One administrator. Two ways in:
 *   · standalone (default): a password (PUBLISHER_ADMIN_PASSWORD, or one created in data/admin-password.txt),
 *     answered with a Bearer token;
 *   · embedded (EMBEDDED=true): the project's own panel sends a signed ticket (see embed.ts) and the session
 *     lives in an httpOnly cookie. There is no password login at all.
 * Sessions are random tokens kept as hashes.
 */
const PASSWORD_FILE = fromRoot('data', 'admin-password.txt');
const COOKIE = 'publisher_session';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');

export function adminPassword(): string {
  const fromEnv = process.env.PUBLISHER_ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (!existsSync(PASSWORD_FILE)) {
    mkdirSync(dirname(PASSWORD_FILE), { recursive: true });
    writeFileSync(PASSWORD_FILE, randomBytes(12).toString('base64url'), { mode: 0o600 });
    console.log('[AUTH] No PUBLISHER_ADMIN_PASSWORD: a password was created in %s', PASSWORD_FILE);
  }
  return readFileSync(PASSWORD_FILE, 'utf8').trim();
}

const same = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

function newSession(days: number): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  db.prepare(`INSERT INTO sessions (token_hash, expires_at) VALUES (?, datetime('now', ?))`).run(hash(token), `+${Math.round(days * 24 * 60)} minutes`);
  return token;
}

/** Standalone: returns a session token, or null when the password is wrong. */
export function login(password: string): string | null {
  if (env.embedded) return null;
  return same(password, adminPassword()) ? newSession(7) : null;
}

/** Embedded: a valid ticket becomes a 12-hour session token. */
export const sessionFromTicket = (): string => newSession(0.5);

export function logout(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
}

const bearer = (req: Request) => /^Bearer\s+(\S+)$/.exec(req.header('authorization') ?? '')?.[1];
export const cookieToken = (req: Request): string | undefined => new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.header('cookie') ?? '')?.[1];
/** The token this request carries, from the Authorization header or (embedded) the session cookie. */
export const sessionToken = (req: Request): string | undefined => bearer(req) ?? cookieToken(req);

export function validSession(token: string | undefined): boolean {
  return !!token && !!db.prepare(`SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')`).get(hash(token));
}

export function setSessionCookie(res: Response, token: string): void {
  const secure = env.panelUrl.startsWith('https://') ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${token}; Path=${env.basePath || '/'}; HttpOnly; SameSite=Lax; Max-Age=${12 * 3600}${secure}`);
}
export function clearSessionCookie(res: Response): void {
  res.append('Set-Cookie', `${COOKIE}=; Path=${env.basePath || '/'}; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Everything under /api/admin needs a valid session. A cookie session also needs the `X-Publisher` header on writes (CSRF). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const viaHeader = bearer(req);
  const token = viaHeader ?? cookieToken(req);
  if (!validSession(token)) {
    res.status(401).json({ error: 'Tu sesión expiró. Vuelve a abrir el publicador desde el panel.' });
    return;
  }
  if (!viaHeader && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.header('x-publisher') !== '1') {
    res.status(403).json({ error: 'Solicitud no permitida.' });
    return;
  }
  next();
}
