import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { VenueContext } from '../../core/venue-context';
import { MascotComponent } from '../../shared/mascot.component';
import { ThemeToggleComponent } from '../../core/theme';
import { AlertToggleComponent } from '../../core/staff-alerts';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'bx-waiter-header',
  standalone: true,
  imports: [RouterLink, MascotComponent, ThemeToggleComponent, IconComponent, AlertToggleComponent],
  template: `
  @if (auth.isSupport()) {
    <div class="support-bar"><bx-icon name="life-buoy" /> Modo soporte: estás dentro de <b>{{ ctx.name() }}</b> como administrador. Todo queda en la bitácora.
      <button class="btn xs" (click)="leaveSupport()">Volver a la plataforma</button></div>
  }
  <header class="wh">
    <div class="container row between">
      <div class="row who">
        @if (back()) { <a class="btn icon sm" [routerLink]="back()" aria-label="Volver"><bx-icon name="arrow-left" /></a> }
        @else { <bx-mascot [size]="36" [animate]="false" /> }
        <div>
          <p class="t">{{ title() }}</p>
          <p class="tiny muted sub">{{ ctx.name() }} · {{ auth.user()?.name }}</p>
        </div>
      </div>
      <div class="row acts">
        <bx-alert-toggle />
        <bx-theme-toggle />
        @if (auth.isAdmin()) { <a class="btn sm" [routerLink]="'/' + ctx.slug() + '/admin'">Panel</a> }
        <button class="btn sm" (click)="auth.logout()"><bx-icon name="log-out" /> Salir</button>
      </div>
    </div>
  </header>`,
  styles: [`
    .wh { position: sticky; top: 0; z-index: 25; background: var(--glass); border-bottom: 1px solid var(--line); padding: 10px 0; }
    .t { font-weight: 800; font-size: 18px; }
    .who { flex: 1; min-width: 0; }
    .who > div { min-width: 0; }
    .sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .acts { flex: none; }
  `],
})
export class WaiterHeaderComponent {
  auth = inject(Auth);
  ctx = inject(VenueContext);
  title = input('Mesas');
  back = input<string | null>(null);
  private router = inject(Router);

  leaveSupport(): void {
    this.auth.logout(false);
    this.router.navigateByUrl('/plataforma');
  }
}

/** Pitido corto y vibración cuando llega algo nuevo. */
export function notifyNew(): void {
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* */ }
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.32);
  } catch { /* */ }
}
