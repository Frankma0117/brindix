import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { VenueContext } from '../../core/venue-context';
import { MascotComponent } from '../../shared/mascot.component';
import { ThemeToggleComponent } from '../../core/theme';

@Component({
  selector: 'bx-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MascotComponent, ThemeToggleComponent],
  template: `
  @if (auth.isSupport()) {
    <div class="support-bar">🛟 Modo soporte: estás dentro de <b>{{ ctx.name() }}</b> como administrador. Todo queda en la bitácora.
      <button class="btn xs" (click)="leaveSupport()">Volver a la plataforma</button></div>
  }
  <div class="shell">
    <aside class="side" [class.open]="menu()">
      <a routerLink="." class="logo" (click)="menu.set(false)">
        @if (ctx.venue()?.logoUrl) { <img [src]="ctx.venue()!.logoUrl" alt=""> } @else { <bx-mascot [size]="40" [animate]="false" /> }
        <span class="ellipsis">{{ ctx.name() }}</span>
      </a>
      <nav>
        @for (g of groups; track g.title) {
          <p class="group">{{ g.title }}</p>
          @for (l of g.links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: l.path === '.' }" (click)="menu.set(false)">
              <span class="ico">{{ l.icon }}</span>{{ l.label }}
            </a>
          }
        }
      </nav>
      <div class="side-foot">
        <a [routerLink]="'/' + ctx.slug() + '/mesero'" class="btn block sm">🍸 Atender mesas</a>
        <a [href]="'/' + ctx.slug() + '/pantalla'" target="_blank" class="btn block sm">📺 Ver pantalla</a>
        <div class="me">
          <div class="grow"><p class="strong small ellipsis">{{ auth.user()?.name }}</p><p class="tiny muted">{{ auth.isSupport() ? 'Soporte Brindix' : 'Administrador' }}</p></div>
          <bx-theme-toggle />
          <button class="btn ghost xs" (click)="auth.logout()">Salir</button>
        </div>
      </div>
    </aside>
    @if (menu()) { <div class="scrim" (click)="menu.set(false)"></div> }
    <div class="main">
      <header class="mobile-top">
        <button class="btn icon sm" (click)="menu.set(true)" aria-label="Menú">☰</button>
        <span class="strong ellipsis">{{ ctx.name() }}</span>
        <div class="row"><bx-theme-toggle /><a [routerLink]="'/' + ctx.slug() + '/mesero'" class="btn sm">Mesas</a></div>
      </header>
      <div class="content"><router-outlet /></div>
    </div>
  </div>`,
  styles: [`
    .shell { display: flex; min-height: 100vh; }
    .side { width: 250px; flex: none; background: var(--bg-2); border-right: 1px solid var(--line); padding: 18px 14px; display: flex; flex-direction: column; gap: 14px; position: sticky; top: 0; height: 100vh; overflow-y: auto; z-index: 40; }
    .logo { display: flex; align-items: center; gap: 10px; color: var(--text); font-family: var(--display); font-weight: 800; font-size: 19px; padding: 0 6px; min-width: 0; }
    .logo img { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    .group { font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--faint); font-weight: 800; padding: 12px 12px 4px; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 12px; color: var(--muted); font-weight: 600; font-size: 14.5px; }
    nav a:hover { background: var(--surface); color: var(--text); }
    nav a.on { background: var(--grad-soft); color: var(--text); box-shadow: inset 3px 0 0 var(--pink); }
    .ico { width: 22px; text-align: center; }
    .side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
    .me { display: flex; align-items: center; gap: 8px; padding: 10px 6px 0; border-top: 1px solid var(--line); margin-top: 6px; }
    .main { flex: 1; min-width: 0; }
    .content { padding: 26px 28px 60px; max-width: 1240px; }
    .mobile-top { display: none; }
    .scrim { position: fixed; inset: 0; background: var(--scrim); z-index: 35; }
    @media (max-width: 900px) {
      .side { position: fixed; left: 0; transform: translateX(-100%); transition: transform .2s ease; }
      .side.open { transform: none; }
      .mobile-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; position: sticky; top: 0; z-index: 30; background: var(--glass); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
      .content { padding: 18px 16px 60px; }
    }
  `],
})
export class AdminShellComponent {
  auth = inject(Auth);
  ctx = inject(VenueContext);
  menu = signal(false);
  private router = inject(Router);

  constructor() {
    if (!this.auth.isSupport()) this.auth.rememberAdminHome('admin');
  }

  /** Sale del bar y vuelve al panel de la plataforma (la sesión de la plataforma sigue abierta). */
  leaveSupport(): void {
    this.auth.logout(false);
    this.router.navigateByUrl('/plataforma');
  }
  groups = [
    { title: 'El día', links: [
      { path: '.', icon: '📊', label: 'Resumen' },
      { path: 'caja', icon: '💵', label: 'Caja y cierre' },
      { path: 'ventas', icon: '💰', label: 'Ventas y ganancias' },
    ] },
    { title: 'El bar', links: [
      { path: 'carta', icon: '🍹', label: 'Carta y productos' },
      { path: 'inventario', icon: '📦', label: 'Inventario' },
      { path: 'mesas', icon: '🪑', label: 'Mesas y QR' },
    ] },
    { title: 'Ambiente', links: [
      { path: 'musica', icon: '🎧', label: 'Música' },
      { path: 'publicidad', icon: '📣', label: 'Publicidad' },
    ] },
    { title: 'Administración', links: [
      { path: 'equipo', icon: '👥', label: 'Equipo' },
      { path: 'bitacora', icon: '📜', label: 'Bitácora' },
      { path: 'configuracion', icon: '⚙️', label: 'Configuración' },
    ] },
  ];
}
