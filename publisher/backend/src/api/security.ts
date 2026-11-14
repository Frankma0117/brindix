import type { NextFunction, Request, Response } from 'express';

/** Standard defensive headers (no external libs). CSP allows only same-origin code. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; " +
      "connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  next();
}

interface Bucket {
  tokens: number;
  updated: number;
}

/** Token-bucket limiter: `capacity` requests burst, refilled at capacity/windowMs. Keyed by IP unless `keyFn` says otherwise. */
export function rateLimit(opts: { capacity: number; windowMs: number; keyFn?: (req: Request) => string; message?: string }) {
  const buckets = new Map<string, Bucket>();
  const refillPerMs = opts.capacity / opts.windowMs;
  setInterval(() => {
    const cutoff = Date.now() - opts.windowMs * 2;
    for (const [k, b] of buckets) if (b.updated < cutoff) buckets.delete(k);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = opts.keyFn ? opts.keyFn(req) : (req.ip ?? 'unknown');
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: opts.capacity, updated: now };
    b.tokens = Math.min(opts.capacity, b.tokens + (now - b.updated) * refillPerMs);
    b.updated = now;
    if (b.tokens < 1) {
      buckets.set(key, b);
      res.setHeader('Retry-After', String(Math.ceil((1 - b.tokens) / refillPerMs / 1000)));
      res.status(429).json({ error: opts.message ?? 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.' });
      return;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    next();
  };
}
