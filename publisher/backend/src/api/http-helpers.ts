import type { NextFunction, Request, Response } from 'express';
import { AccessError } from '../models/permissions.model.js';

/**
 * Wraps a route handler (sync or async). A business error (AccessError: a message meant for the
 * person using the panel) becomes a 400 with that message; anything else goes to the global error
 * handler (logged, generic 500) - never an unhandled rejection.
 */
export function h(fn: (req: Request, res: Response) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch((err: unknown) => {
        if (res.headersSent) return;
        if (err instanceof AccessError) return void res.status(400).json({ error: err.message });
        if ((err as { code?: string }).code?.startsWith('SQLITE_CONSTRAINT')) return void res.status(409).json({ error: 'Los datos no son válidos o ya existen.' });
        next(err);
      });
  };
}

/** This app has a single administrator. */
export const userId = (_req?: Request): number => 1;

export const str = (v: unknown, max = 500): string | undefined => (v === undefined || v === null ? undefined : String(v).trim().slice(0, max));
export const int = (v: unknown): number | undefined => (v === undefined || v === null || v === '' ? undefined : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : undefined);
export const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
export const intArr = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n)) : []);
