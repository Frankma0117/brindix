import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { VenueContext } from '../../core/venue-context';
import { MascotComponent } from '../../shared/mascot.component';
import { ThemeToggleComponent } from '../../core/theme';
import { AlertToggleComponent } from '../../core/staff-alerts';
import { IconComponent } from '../../shared/icon.component';
import { IconName } from '../../shared/icons';
import { BarSwitcherComponent } from '../../shared/bar-switcher.component';

@Component({
  selector: 'bx-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MascotComponent, ThemeToggleComponent, IconComponent, AlertToggleComponent, BarSwitcherComponent],
  template: `
  @if (auth.isSupport()) {
    <div class="support-bar"><bx-icon name="life-buoy" /> Modo soporte: estás dentro de <b>{{ ctx.name() }}</b> como administrador. Todo queda en la bitácora.
      <button class="btn xs" (click)="leaveSupport()">Volver a la plataforma</button></div>
  }
  <div class="shell" [class.with-bar]="auth.isSupport()">
    <aside class="side" [class.open]="menu()">
      @if (auth.isSupport()) {
        <bx-bar-switcher [current]="ctx.name()" [slug]="ctx.slug()" />
      } @else {
        <a routerLink="." class="logo" (click)="menu.set(false)">
          @if (ctx.venue()?.logoUrl) { <img [src]="ctx.venue()!.logoUrl" alt=""> } @else { <bx-mascot [size]="40" [animate]="false" /> }
          <span class="ellipsis">{{ ctx.name() }}</span>
        </a>
      }
      <nav>
        @for (g of groups; track g.title) {
          <button type="button" class="group" [attr.aria-expanded]="!closed().includes(g.title)" (click)="fold(g.title)">
            {{ g.title }}<bx-icon class="chev" [class.shut]="closed().includes(g.title)" name="chevron-down" />
          </button>
          <div class="fold" [class.shut]="closed().includes(g.title)"><div class="fold-in">
            @for (l of g.links; track l.path) {
              <a [routerLink]="l.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: l.path === '.' }" [attr.tabindex]="closed().includes(g.title) ? -1 : null" (click)="menu.set(false)">
                <bx-icon class="ico" [name]="l.icon" />{{ l.label }}
              </a>
            }
          </div></div>
        }
      </nav>
      <div class="side-foot">
        <a [routerLink]="'/' + ctx.slug() + '/mesero'" class="btn block sm"><bx-icon name="martini" /> Atender mesas</a>
        <a [href]="'/' + ctx.slug() + '/pantalla'" target="_blank" class="btn block sm"><bx-icon name="tv" /> Ver pantalla</a>
        <div class="me">
          <div class="grow"><p class="strong small ellipsis">{{ auth.user()?.name }}</p><p class="tiny muted">{{ auth.isSupport() ? 'Soporte Brindix' : 'Administrador' }}</p></div>
          <bx-alert-toggle />
          <bx-theme-toggle />
        </div>
        <button class="btn block sm" (click)="auth.logout()"><bx-icon name="log-out" /> Cerrar sesión</button>
      </div>
    </aside>
    @if (menu()) { <div class="scrim" (click)="menu.set(false)"></div> }
    <div class="main">
      <header class="mobile-top">
        <button class="btn icon sm" (click)="menu.set(true)" aria-label="Menú"><bx-icon name="menu" /></button>
        <span class="strong ellipsis">{{ ctx.name() }}</span>
        <div class="row"><bx-alert-toggle /><bx-theme-toggle /><a [routerLink]="'/' + ctx.slug() + '/mesero'" class="btn sm">Mesas</a></div>
      </header>
      <div class="content"><router-outlet /></div>
    </div>
  </div>`,
  styles: [`
    .shell { display: flex; min-height: 100vh; }
    .side { width: 250px; flex: none; background: var(--bg-2); border-right: 1px solid var(--line); padding: 18px 14px; display: flex; flex-direction: column; gap: 14px; position: sticky; top: 0; height: 100vh; overflow: hidden; z-index: 40; }
    .logo { display: flex; align-items: center; gap: 10px; color: var(--text); font-weight: 800; font-size: 17px; padding: 0 6px; min-width: 0; }
    .logo img { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; }
    nav { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    .group { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: 0; text-align: left; font: inherit; font-size: 12px; color: var(--faint); font-weight: 700; padding: 14px 12px 4px; cursor: pointer; }
    .group .chev { --icon-size: 14px; transition: transform 200ms var(--ease-out); }
    .group .chev.shut { transform: rotate(-90deg); }
    .fold { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 200ms var(--ease-out); }
    .fold.shut { grid-template-rows: 0fr; }
    .fold-in { overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
    @media (prefers-reduced-motion: reduce) { .fold, .group .chev { transition: none; } }
    nav a { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 10px; color: var(--muted); font-weight: 600; font-size: 14.5px; transition: background-color 150ms ease, color 150ms ease; }
    @media (hover: hover) and (pointer: fine) { nav a:hover { background: var(--surface); color: var(--text); } }
    nav a.on { background: var(--surface-2); color: var(--text); font-weight: 750; }
    nav a.on .ico { color: var(--amber); }
    .ico { --icon-size: 19px; }
    .side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
    .me { display: flex; align-items: center; gap: 8px; padding: 10px 6px 0; border-top: 1px solid var(--line); margin-top: 6px; }
    .main { flex: 1; min-width: 0; }
    .content { padding: 26px 28px 60px; max-width: 1240px; }
    .mobile-top { display: none; }
    .scrim { position: fixed; inset: 0; background: var(--scrim); z-index: 35; }
    /* En modo soporte la franja de arriba (44 px) empuja el menú: se acorta para que «Cerrar sesión» siga a la vista. */
    .shell.with-bar .side { top: 44px; height: calc(100vh - 44px); }
    @media (max-width: 900px) {
      .side { position: fixed; left: 0; transform: translateX(-100%); transition: transform 240ms var(--ease-drawer); }
      .side.open { transform: none; }
      .mobile-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; position: sticky; top: 0; z-index: 30; background: var(--glass); border-bottom: 1px solid var(--line); }
      .content { padding: 18px 16px 60px; }
    }
  `],
})
export class AdminShellComponent {
  auth = inject(Auth);
  ctx = inject(VenueContext);
  menu = signal(false);
  /** Grupos del menú plegados; se recuerdan en este navegador. */
  closed = signal<string[]>(this.readClosed());
  private router = inject(Router);

  constructor() {
    if (!this.auth.isSupport()) this.auth.rememberAdminHome('admin');
  }

  fold(title: string): void {
    const next = this.closed().includes(title) ? this.closed().filter(x => x !== title) : [...this.closed(), title];
    this.closed.set(next);
    try { localStorage.setItem('brindix.menu-closed', JSON.stringify(next)); } catch { /* sin almacenamiento: no se recuerda */ }
  }

  private readClosed(): string[] {
    try { return JSON.parse(localStorage.getItem('brindix.menu-closed') ?? '[]'); } catch { return []; }
  }

  /** Sale del bar y vuelve al panel de la plataforma (la sesión de la plataforma sigue abierta). */
  leaveSupport(): void {
    this.auth.logout(false);
    this.router.navigateByUrl('/plataforma');
  }
  groups: { title: string; links: { path: string; icon: IconName; label: string }[] }[] = [
    { title: 'El día', links: [
      { path: '.', icon: 'chart-column', label: 'Resumen' },
      { path: 'caja', icon: 'banknote', label: 'Caja y cierre' },
      { path: 'ventas', icon: 'chart-line', label: 'Ventas y ganancias' },
    ] },
    { title: 'El bar', links: [
      { path: 'carta', icon: 'wine', label: 'Carta y productos' },
      { path: 'inventario', icon: 'package', label: 'Inventario' },
      { path: 'mesas', icon: 'qr-code', label: 'Mesas y QR' },
    ] },
    { title: 'Ambiente', links: [
      { path: 'musica', icon: 'headphones', label: 'Música' },
      { path: 'publicidad', icon: 'megaphone', label: 'Publicidad' },
    ] },
    { title: 'Administración', links: [
      { path: 'equipo', icon: 'users', label: 'Equipo' },
      { path: 'bitacora', icon: 'scroll-text', label: 'Bitácora' },
      { path: 'configuracion', icon: 'settings', label: 'Configuración' },
    ] },
  ];
}
