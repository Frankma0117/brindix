import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth.service';
import { MascotComponent } from '../shared/mascot.component';

@Component({
  selector: 'bx-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MascotComponent],
  template: `
  <div class="shell">
    <aside class="side" [class.open]="menu()">
      <a routerLink="/admin" class="logo" (click)="menu.set(false)">
        <bx-mascot [size]="42" [animate]="false" />
        <span>Brindix</span>
      </a>
      <nav>
        @for (l of links; track l.path) {
          <a [routerLink]="l.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: l.path === '/admin' }" (click)="menu.set(false)">
            <span class="ico">{{ l.icon }}</span>{{ l.label }}
          </a>
        }
      </nav>
      <div class="side-foot">
        <a routerLink="/mesero" class="btn block sm">🍸 Modo mesero</a>
        <a routerLink="/pantalla" target="_blank" class="btn block sm">📺 Abrir pantalla</a>
        <div class="me">
          <div class="grow"><p class="strong small ellipsis">{{ auth.user()?.name }}</p><p class="tiny muted">Administrador</p></div>
          <button class="btn ghost xs" (click)="auth.logout()">Salir</button>
        </div>
      </div>
    </aside>
    @if (menu()) { <div class="scrim" (click)="menu.set(false)"></div> }
    <div class="main">
      <header class="mobile-top">
        <button class="btn icon sm" (click)="menu.set(true)" aria-label="Menú">☰</button>
        <span class="strong">Brindix</span>
        <a routerLink="/mesero" class="btn sm">Mesero</a>
      </header>
      <div class="content"><router-outlet /></div>
    </div>
  </div>`,
  styles: [`
    .shell { display: flex; min-height: 100vh; }
    .side { width: 248px; flex: none; background: var(--bg-2); border-right: 1px solid var(--line); padding: 18px 14px; display: flex; flex-direction: column; gap: 18px; position: sticky; top: 0; height: 100vh; overflow-y: auto; z-index: 40; }
    .logo { display: flex; align-items: center; gap: 10px; color: var(--text); font-family: var(--display); font-weight: 800; font-size: 22px; padding: 0 6px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; color: var(--muted); font-weight: 600; }
    nav a:hover { background: var(--surface); color: var(--text); }
    nav a.on { background: var(--grad-soft); color: var(--text); box-shadow: inset 3px 0 0 var(--pink); }
    .ico { width: 22px; text-align: center; }
    .side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
    .me { display: flex; align-items: center; gap: 8px; padding: 10px 6px 0; border-top: 1px solid var(--line); margin-top: 6px; }
    .main { flex: 1; min-width: 0; }
    .content { padding: 26px 28px 60px; max-width: 1240px; }
    .mobile-top { display: none; }
    .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 35; }
    @media (max-width: 900px) {
      .side { position: fixed; left: 0; transform: translateX(-100%); transition: transform .2s ease; }
      .side.open { transform: none; }
      .mobile-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; position: sticky; top: 0; z-index: 30; background: rgba(12,10,18,.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
      .content { padding: 18px 16px 60px; }
    }
  `],
})
export class AdminShellComponent {
  auth = inject(Auth);
  menu = signal(false);
  links = [
    { path: '/admin', icon: '📊', label: 'Resumen' },
    { path: '/admin/productos', icon: '🍹', label: 'Carta y productos' },
    { path: '/admin/inventario', icon: '📦', label: 'Inventario' },
    { path: '/admin/mesas', icon: '🪑', label: 'Mesas y QR' },
    { path: '/admin/musica', icon: '🎧', label: 'Música' },
    { path: '/admin/publicidad', icon: '📣', label: 'Publicidad' },
    { path: '/admin/ventas', icon: '💰', label: 'Ventas' },
    { path: '/admin/equipo', icon: '👥', label: 'Equipo' },
    { path: '/admin/ajustes', icon: '⚙️', label: 'Ajustes' },
  ];
}
