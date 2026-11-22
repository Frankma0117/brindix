import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { VenueContext } from '../../core/venue-context';
import { AppNotification } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { IconName } from '../../shared/icons';
import { NotificationsService } from './notifications.service';

/** Campana del administrador: avisos y lista «Por configurar». Popover en escritorio, hoja inferior en celular. */
@Component({
  selector: 'bx-notifications-panel',
  standalone: true,
  imports: [IconComponent],
  template: `
  <button type="button" class="btn icon sm bell" (click)="toggle()" [attr.aria-expanded]="open()" aria-label="Notificaciones">
    <bx-icon name="bell" />
    @if (svc.unread() > 0) { <span class="count">{{ svc.unread() > 9 ? '9+' : svc.unread() }}</span> }
  </button>
  @if (open()) {
    <div class="veil" (click)="open.set(false)"></div>
    <section class="panel" role="dialog" aria-label="Notificaciones">
      <header>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [class.on]="tab() === 'avisos'" [attr.aria-selected]="tab() === 'avisos'" (click)="tab.set('avisos')">
            Avisos @if (svc.unread() > 0) { <span class="n">{{ svc.unread() }}</span> }
          </button>
          <button type="button" role="tab" [class.on]="tab() === 'setup'" [attr.aria-selected]="tab() === 'setup'" (click)="tab.set('setup')">
            Por configurar @if (pending() > 0) { <span class="n">{{ pending() }}</span> }
          </button>
        </div>
        <button type="button" class="btn icon sm ghost" (click)="open.set(false)" aria-label="Cerrar"><bx-icon name="x" /></button>
      </header>

      @if (tab() === 'avisos') {
        <div class="body">
          @if (svc.items().length === 0) {
            <p class="empty">Sin avisos por ahora.</p>
          }
          @for (n of svc.items(); track n.id) {
            <button type="button" class="item" [class.unread]="!n.read" (click)="go(n)">
              <bx-icon class="kind" [name]="icon(n.type)" />
              <span class="txt">
                <span class="t">{{ n.title }}</span>
                @if (n.body) { <span class="b">{{ n.body }}</span> }
              </span>
              <span class="when">{{ since(n.createdAt) }}</span>
            </button>
          }
        </div>
        @if (svc.unread() > 0) {
          <footer><button type="button" class="btn sm block" (click)="svc.markAllRead()">Marcar todo como leído</button></footer>
        }
      } @else {
        <div class="body">
          @for (s of svc.setup(); track s.key) {
            @if (s.done) {
              <div class="step done"><bx-icon class="kind" name="circle-check" /><span class="txt"><span class="t">{{ s.title }}</span></span></div>
            } @else {
              <button type="button" class="step" (click)="goTo(s.link)">
                <span class="ring"></span>
                <span class="txt"><span class="t">{{ s.title }}</span><span class="b">{{ s.hint }}</span></span>
                <bx-icon class="go" name="chevron-right" />
              </button>
            }
          }
          @if (svc.setup().length > 0 && pending() === 0) { <p class="empty">Todo está configurado.</p> }
        </div>
      }
    </section>
  }`,
  styles: [`
    :host { display: inline-flex; }
    .bell { position: relative; }
    .count { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--c-red); color: #1c0f08; font-size: 10.5px; font-weight: 800; line-height: 17px; text-align: center; }
    .veil { position: fixed; inset: 0; z-index: 60; }
    .panel { position: fixed; z-index: 61; display: flex; flex-direction: column; background: var(--bg-2); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 12px 40px var(--scrim); color: var(--text); text-align: left;
      left: 262px; bottom: 16px; width: 380px; max-height: min(70vh, 560px); transform-origin: bottom left; animation: pop 180ms var(--ease-out); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 8px 0 10px; border-bottom: 1px solid var(--line); }
    .tabs { display: flex; gap: 2px; }
    .tabs button { background: none; border: 0; border-bottom: 2px solid transparent; font: inherit; font-size: 13.5px; font-weight: 700; color: var(--muted); padding: 8px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: color 150ms ease, border-color 150ms ease; }
    .tabs button:active { transform: scale(.97); }
    .tabs button.on { color: var(--text); border-bottom-color: var(--c-amber); }
    .n { font-size: 11px; font-weight: 800; padding: 0 6px; border-radius: 8px; background: var(--hover); color: var(--c-amber); }
    .body { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; min-height: 120px; }
    .item, .step { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px; border: 0; border-radius: 10px; background: none; font: inherit; color: var(--muted); text-align: left; cursor: pointer; transition: background-color 150ms ease; }
    .item:active, .step:active { transform: scale(.97); }
    .item.unread { color: var(--text); background: var(--hover); }
    .item.unread .t { font-weight: 800; }
    .kind { --icon-size: 18px; flex: none; margin-top: 1px; color: var(--c-amber); }
    .step.done { cursor: default; opacity: .7; }
    .step.done .t { text-decoration: line-through; }
    .step.done .kind { color: var(--c-green); }
    .ring { flex: none; width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; border: 2px solid var(--faint); }
    .go { --icon-size: 16px; flex: none; align-self: center; color: var(--faint); }
    .txt { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .t { font-size: 14px; font-weight: 650; color: var(--text); }
    .b { font-size: 12.5px; color: var(--muted); }
    .when { flex: none; font-size: 11.5px; color: var(--faint); margin-top: 2px; }
    .empty { margin: 0; padding: 28px 12px; text-align: center; font-size: 13.5px; color: var(--muted); }
    footer { padding: 8px; border-top: 1px solid var(--line); }
    @keyframes pop { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes sheet { from { transform: translateY(100%); } to { transform: none; } }
    @media (hover: hover) and (pointer: fine) {
      .item:hover, .step:not(.done):hover { background: var(--hover); }
      .tabs button:hover { color: var(--text); }
    }
    @media (max-width: 900px) {
      .panel { left: 0; right: 0; bottom: 0; width: auto; max-height: 80vh; border-radius: 18px 18px 0 0; border-bottom: 0; transform-origin: bottom center; animation: sheet 240ms var(--ease-drawer); }
      .veil { background: var(--scrim); }
    }
    @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
  `],
})
export class NotificationsPanelComponent implements OnInit, OnDestroy {
  svc = inject(NotificationsService);
  private router = inject(Router);
  private ctx = inject(VenueContext);
  open = signal(false);
  tab = signal<'avisos' | 'setup'>('avisos');
  pending = computed(() => this.svc.setup().filter(s => !s.done).length);

  ngOnInit(): void {
    this.svc.acquire();
    this.svc.loadSetup();
  }

  ngOnDestroy(): void { this.svc.release(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.open.set(false); }

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      this.svc.refresh();
      this.svc.loadSetup();
    }
  }

  go(n: AppNotification): void {
    this.svc.markRead(n);
    this.goTo(n.link ?? '');
  }

  goTo(link: string): void {
    this.open.set(false);
    // Un enlace que empieza con "/" es una ruta del bar fuera del admin (p. ej. "/mesero").
    if (link.startsWith('/')) this.router.navigate(['/', this.ctx.slug(), link.slice(1)]);
    else this.router.navigate(link ? ['/', this.ctx.slug(), 'admin', link] : ['/', this.ctx.slug(), 'admin']);
  }

  icon(type: string): IconName {
    switch (type) {
      case 'CLIENT_ORDER': return 'receipt';
      case 'LOW_STOCK': return 'package';
      case 'PASSWORD_RESET': return 'lock';
      case 'SHIFT_OPEN': return 'clock';
      case 'DEBT_OLD': return 'hand-coins';
      default: return 'info';
    }
  }

  since(iso: string): string {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }
}
