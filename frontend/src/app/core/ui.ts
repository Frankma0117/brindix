import { Injectable, Pipe, PipeTransform, signal } from '@angular/core';

/** Avisos flotantes ("toast"). */
export interface Toast { id: number; text: string; kind: 'ok' | 'error' | 'info'; }

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly list = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'info', ms = 3500): void {
    const t = { id: ++this.seq, text, kind };
    this.list.update(l => [...l, t]);
    setTimeout(() => this.list.update(l => l.filter(x => x.id !== t.id)), ms);
  }
  ok(text: string): void { this.show(text, 'ok'); }
  error(text: string): void { this.show(text, 'error', 5000); }
}

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export function formatMoney(v: number | null | undefined): string {
  return money.format(Number(v ?? 0)).replace(/ /g, ' ');
}

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(v: number | null | undefined): string { return formatMoney(v); }
}

/** "hace 5 min" */
@Pipe({ name: 'ago', standalone: true })
export class AgoPipe implements PipeTransform {
  transform(iso?: string | null): string {
    if (!iso) return '';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'ahora';
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    return `hace ${h} h ${m % 60} min`;
  }
}

@Pipe({ name: 'hour', standalone: true })
export class HourPipe implements PipeTransform {
  transform(iso?: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }
}

export function duration(ms?: number | null): string {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Guarda en localStorage sin romper en modo privado. */
export const store = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
  },
  set(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
  },
};
