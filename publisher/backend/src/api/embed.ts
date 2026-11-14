import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Single sign-on for the publisher embedded in a project's own panel (EMBEDDED=true).
 *
 * The project's backend, once it has authenticated its administrator by its own means, builds a TICKET and
 * sends the browser to  <BASE_PATH>/sso?ticket=<ticket>.  The publisher checks it and opens its own session
 * (httpOnly cookie). Ticket format (any language can make it):
 *
 *   payload = base64url( {"exp": <unix seconds>, "n": "<random>"} )
 *   ticket  = payload + "." + hex( HMAC_SHA256( EMBED_SECRET, payload ) )
 *
 * Valid up to 10 minutes ahead, single use. See README.md for Java and TypeScript examples.
 */
const MAX_TTL_SEC = 600;
const used = new Map<string, number>(); // nonce → exp (seconds), kept until it expires

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

/** For tests and for Node projects that want to issue tickets. */
export function makeTicket(secret: string, ttlSec = 300): string {
  const payload = b64(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSec, n: randomBytes(12).toString('hex') }));
  return `${payload}.${sign(secret, payload)}`;
}

/** True when the ticket is authentic, not expired and not used before (and marks it used). */
export function redeemTicket(secret: string, ticket: string): boolean {
  if (!secret) return false;
  const [payload, mac, extra] = String(ticket).split('.');
  if (!payload || !mac || extra !== undefined) return false;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  let data: { exp?: number; n?: string };
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof data.exp !== 'number' || typeof data.n !== 'string' || data.exp <= now || data.exp - now > MAX_TTL_SEC) return false;
  for (const [n, exp] of used) if (exp <= now) used.delete(n);
  if (used.has(data.n)) return false;
  used.set(data.n, data.exp);
  return true;
}
