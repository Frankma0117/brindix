import { Component, Injectable, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription, timer } from 'rxjs';
import { Api, errorMessage } from './api.service';
import { Auth } from './auth.service';
import { Board } from './models';
import { AgoPipe, store, Toasts } from './ui';
import { IconComponent } from '../shared/icon.component';
import { IconName } from '../shared/icons';

export type AlertKind = 'WAITER' | 'BILL' | 'ORDER' | 'DELIVER';

export interface StaffAlert {
  key: string; kind: AlertKind; table: string; tabId?: number; callId?: number; roundId?: number;
  at: string; detail?: string;
}

const SOUND_KEY = 'brindix.sound';
const TITLES: Record<AlertKind, (t: string) => string> = {
  WAITER: t => `${t} te está llamando`,
  BILL: t => `${t} pide la cuenta`,
  ORDER: t => `${t} hizo un pedido`,
  DELIVER: t => `Te toca llevar a ${t}`,
};
const ICONS: Record<AlertKind, IconName> = { WAITER: 'hand', BILL: 'receipt', ORDER: 'bell-ring', DELIVER: 'footprints' };
/** Lo urgente (llamados y cuentas) vuelve a sonar cada minuto, hasta 3 veces, si nadie lo atiende. */
const REMIND_MS = 60_000;
const MAX_REMINDERS = 3;

/**
 * Avisos del personal en cualquier vista del bar (mesas, cuenta, caja, carta, configuración…):
 * mesas que llaman, piden la cuenta, pedidos desde el QR (administrador) y rondas que te toca llevar.
 * Sonido distinto por tipo, vibración, notificación del sistema con la pestaña en segundo plano y conteo en el título.
 */
@Injectable({ providedIn: 'root' })
export class StaffAlerts {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);

  readonly alerts = signal<StaffAlert[]>([]);
  readonly sound = signal(store.get<boolean>(SOUND_KEY, true));
  readonly active = signal(false);
  readonly slug = signal('');
  readonly permission = signal<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  readonly count = computed(() => this.alerts().length);

  private poll?: Subscription;
  private known = new Set<string>();
  private dismissed = new Set<string>();
  private reminders = new Map<string, number>();
  private primed = false;
  private audio?: AudioContext;
  private baseTitle = document.title;

  constructor() {
    const check = () => {
      const m = this.router.url.match(/^\/([^/?#]+)\/(admin|mesero)(?:[/?#]|$)/);
      const on = !!m && this.auth.inVenue(m[1]) && !this.auth.mustChange();
      this.slug.set(m?.[1] ?? '');
      if (on !== this.active()) on ? this.start() : this.stop();
    };
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(check);
    effect(() => { this.auth.session(); queueMicrotask(check); });
    // Los navegadores no dejan sonar sin un toque: el primer toque de la sesión habilita el audio.
    const unlock = () => { this.ctx()?.resume?.(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    effect(() => {
      const n = this.count();
      document.title = n ? `(${n}) ${this.baseTitle.replace(/^\(\d+\)\s*/, '')}` : this.baseTitle.replace(/^\(\d+\)\s*/, '');
    });
  }

  toggleSound(): void {
    this.sound.update(v => !v);
    store.set(SOUND_KEY, this.sound());
    if (this.sound()) this.play('DELIVER');
  }

  async askPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.permission.set(await Notification.requestPermission());
  }

  dismiss(a: StaffAlert): void {
    this.dismissed.add(a.key);
    this.alerts.update(l => l.filter(x => x.key !== a.key));
  }

  /** Marca el llamado como atendido en el servidor. */
  async done(a: StaffAlert): Promise<void> {
    if (a.callId) await new Promise<void>((ok, fail) => this.api.post(`/staff/calls/${a.callId}/done`, {}).subscribe({ next: () => ok(), error: fail }));
    this.dismiss(a);
  }

  private start(): void {
    this.active.set(true);
    this.primed = false;
    this.known.clear();
    this.poll = timer(0, 5000).subscribe(() => this.api.get<Board>('/staff/board').subscribe({ next: b => this.apply(b), error: () => {} }));
  }

  private stop(): void {
    this.active.set(false);
    this.poll?.unsubscribe();
    this.alerts.set([]);
  }

  private apply(b: Board): void {
    const admin = this.auth.isAdmin();
    const me = this.auth.user()?.id;
    const now: StaffAlert[] = [
      ...b.calls.map(c => ({ key: 'c' + c.id, kind: c.type as AlertKind, table: c.tableName, callId: c.id, tabId: b.tables.find(t => t.tableId === c.tableId)?.tabId, at: c.createdAt })),
      ...(admin ? b.pending.map(r => ({ key: 'o' + r.id, kind: 'ORDER' as const, table: r.tableName ?? 'Una mesa', roundId: r.id, tabId: r.tabId, at: r.createdAt,
        detail: r.items.filter(i => !i.voided).map(i => `${i.quantity}× ${i.productName}`).join(', ') })) : []),
      ...b.inProgress.filter(r => r.assignedTo === me).map(r => ({ key: 'd' + r.id, kind: 'DELIVER' as const, table: r.tableName ?? 'una mesa', roundId: r.id, tabId: r.tabId,
        at: r.confirmedAt ?? r.createdAt, detail: r.items.filter(i => !i.voided).map(i => `${i.quantity}× ${i.productName}`).join(', ') })),
    ].map(a => ({ ...a, table: a.table ?? 'Una mesa' }));

    const fresh = now.filter(a => !this.known.has(a.key));
    now.forEach(a => this.known.add(a.key));
    const visible = now.filter(a => !this.dismissed.has(a.key));
    this.alerts.set(visible.sort((x, y) => (rank(y.kind) - rank(x.kind)) || x.at.localeCompare(y.at)));

    if (this.primed && fresh.length) {
      const top = fresh.sort((x, y) => rank(y.kind) - rank(x.kind))[0];
      this.ring(top.kind);
      if (document.hidden) this.systemNotice(fresh);
      fresh.forEach(a => this.reminders.set(a.key, Date.now()));
    }
    // Recordatorio para lo urgente que sigue sin atender.
    for (const a of visible.filter(x => x.kind === 'WAITER' || x.kind === 'BILL')) {
      const last = this.reminders.get(a.key) ?? Date.now();
      const n = this.reminders.get(a.key + '#') ?? 0;
      if (Date.now() - last > REMIND_MS && n < MAX_REMINDERS) {
        this.ring(a.kind);
        this.reminders.set(a.key, Date.now());
        this.reminders.set(a.key + '#', n + 1);
      } else if (!this.reminders.has(a.key)) this.reminders.set(a.key, Date.now());
    }
    this.primed = true;
  }

  private ring(kind: AlertKind): void {
    try { navigator.vibrate?.(kind === 'BILL' || kind === 'WAITER' ? [160, 80, 160] : [120]); } catch { /* */ }
    if (this.sound()) this.play(kind);
  }

  private systemNotice(list: StaffAlert[]): void {
    if (this.permission() !== 'granted') return;
    try {
      const a = list[0];
      const n = new Notification(TITLES[a.kind](a.table), { body: list.length > 1 ? `y ${list.length - 1} aviso(s) más` : (a.detail ?? 'Toca para verlo'), tag: 'brindix-' + a.key });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* */ }
  }

  private ctx(): AudioContext | undefined {
    try { this.audio ??= new AudioContext(); } catch { return undefined; }
    return this.audio;
  }

  /** Sonidos cortos y distintos (Web Audio, sin archivos). */
  play(kind: AlertKind): void {
    const ctx = this.ctx();
    if (!ctx) return;
    ctx.resume?.();
    const t0 = ctx.currentTime + 0.02;
    const note = (freq: number, at: number, len: number, type: OscillatorType = 'sine', vol = 0.28) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0 + at);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + len + 0.02);
    };
    switch (kind) {
      case 'WAITER': note(880, 0, 0.42); note(659, 0.32, 0.6); break;                       // ding-dong: «te llaman»
      case 'BILL': note(659, 0, 0.18, 'triangle'); note(880, 0.12, 0.18, 'triangle'); note(1175, 0.24, 0.45, 'triangle'); break; // caja
      case 'ORDER': note(1047, 0, 0.12, 'square', 0.12); note(1047, 0.16, 0.12, 'square', 0.12); note(1319, 0.32, 0.25, 'square', 0.1); break;
      case 'DELIVER': note(784, 0, 0.5); note(1568, 0, 0.35, 'sine', 0.08); break;          // campanita suave
    }
  }

  title(a: StaffAlert): string { return TITLES[a.kind](a.table); }
  icon(a: StaffAlert): IconName { return ICONS[a.kind]; }
}

function rank(k: AlertKind): number {
  return { BILL: 4, WAITER: 3, ORDER: 2, DELIVER: 1 }[k];
}

/** Pila de avisos fija arriba de cualquier vista del personal. */
@Component({
  selector: 'bx-staff-alerts',
  standalone: true,
  imports: [IconComponent, AgoPipe],
  template: `
  @if (s.active() && s.alerts().length) {
    <section class="stack" aria-live="assertive" aria-label="Avisos de las mesas">
      @for (a of s.alerts().slice(0, shown()); track a.key) {
        <article class="alert" [attr.data-kind]="a.kind">
          <span class="ico"><bx-icon [name]="s.icon(a)" /></span>
          <div class="grow">
            <p class="t">{{ s.title(a) }}</p>
            <p class="d">@if (a.detail) { {{ a.detail }} · } {{ a.at | ago }}</p>
          </div>
          <div class="acts">
            @if (a.tabId) { <button class="btn sm" (click)="open(a)">Ver mesa</button> }
            @else if (a.kind === 'ORDER') { <button class="btn sm" (click)="board()">Asignar</button> }
            @if (a.callId) { <button class="btn sm primary" (click)="done(a)">Listo</button> }
            @else { <button class="btn icon sm" (click)="s.dismiss(a)" aria-label="Ocultar aviso"><bx-icon name="x" /></button> }
          </div>
        </article>
      }
      @if (s.alerts().length > shown()) { <button class="more" (click)="expanded.set(true)">+ {{ s.alerts().length - shown() }} {{ s.alerts().length - shown() === 1 ? 'aviso más' : 'avisos más' }}</button> }
      @else if (expanded() && s.alerts().length > 1) { <button class="more" (click)="expanded.set(false)">Mostrar menos</button> }
    </section>
  }`,
  styles: [`
    .stack { position: fixed; z-index: 80; bottom: 18px; right: 18px; width: min(420px, calc(100vw - 24px)); display: flex; flex-direction: column-reverse; gap: 8px; }
    .alert { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line-2);
      box-shadow: var(--shadow-lg); animation: in 240ms var(--ease-out); }
    @keyframes in { from { opacity: 0; transform: translateY(10px) scale(.98); } }
    .alert[data-kind=BILL], .alert[data-kind=WAITER] { border-color: rgba(255,178,56,.6); }
    .alert[data-kind=ORDER] { border-color: rgba(255,92,108,.55); }
    .ico { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 12px; --icon-size: 22px; background: rgba(255,178,56,.16); color: var(--c-amber); }
    .alert[data-kind=ORDER] .ico { background: rgba(255,92,108,.15); color: var(--c-pink); }
    .alert[data-kind=DELIVER] .ico { background: rgba(94,194,171,.16); color: var(--c-teal); }
    .alert[data-kind=BILL] .ico, .alert[data-kind=WAITER] .ico { animation: ring 1.4s var(--ease-out) 2; }
    @keyframes ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,178,56,.5); } 50% { box-shadow: 0 0 0 8px rgba(255,178,56,0); } }
    @media (prefers-reduced-motion: reduce) { .alert, .ico { animation: none !important; } }
    .t { font-weight: 800; font-size: 15px; line-height: 1.25; }
    .d { font-size: 12.5px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .acts { display: flex; gap: 6px; flex: none; }
    .more { cursor: pointer; font-family: inherit; align-self: flex-end; font-size: 12.5px; font-weight: 700; color: var(--muted); padding: 4px 10px; border-radius: 99px; background: var(--surface); border: 1px solid var(--line); }
    @media (max-width: 520px) {
      .stack { left: 8px; right: 8px; width: auto; bottom: auto; top: calc(8px + env(safe-area-inset-top)); flex-direction: column; }
      .alert { padding: 8px 8px 8px 10px; gap: 10px; border-radius: 14px; }
      .ico { width: 34px; height: 34px; --icon-size: 18px; }
      .t { font-size: 14px; } .d { -webkit-line-clamp: 1; font-size: 12px; }
      .acts .btn { height: 36px; padding: 0 10px; }
      .acts .btn:not(.primary):not(.icon) { display: none; }
    }
  `],
})
export class StaffAlertsComponent {
  s = inject(StaffAlerts);
  expanded = signal(false);
  private mobile = signal(matchMedia('(max-width: 520px)').matches);
  /** En el celular se ve solo el más urgente (los demás con «+N»); en el computador hasta 3. */
  shown = computed(() => this.expanded() ? 8 : this.mobile() ? 1 : 3);
  private router = inject(Router);
  private toasts = inject(Toasts);

  open(a: StaffAlert): void {
    this.router.navigate(['/', this.s.slug(), 'mesero', 'cuenta', a.tabId]);
  }

  board(): void {
    this.router.navigate(['/', this.s.slug(), 'mesero']);
  }

  async done(a: StaffAlert): Promise<void> {
    try { await this.s.done(a); } catch (e) { this.toasts.error(errorMessage(e)); }
  }
}

/** Botón de campana: silencia o activa los sonidos y pide permiso para avisos del sistema. */
@Component({
  selector: 'bx-alert-toggle',
  standalone: true,
  imports: [IconComponent],
  template: `
    <button type="button" class="btn icon sm" [class.off]="!s.sound()" (click)="toggle()"
            [title]="s.sound() ? 'Sonido de avisos activado (toca para silenciar)' : 'Avisos en silencio (toca para activar)'"
            [attr.aria-label]="s.sound() ? 'Silenciar avisos' : 'Activar sonido de avisos'">
      <bx-icon [name]="s.sound() ? 'bell-ring' : 'bell-off'" />
    </button>`,
  styles: ['.off { color: var(--faint); }'],
})
export class AlertToggleComponent {
  s = inject(StaffAlerts);

  toggle(): void {
    this.s.toggleSound();
    if (this.s.permission() === 'default') this.s.askPermission();
  }
}
