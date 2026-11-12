import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { VenueContext } from '../core/venue-context';
import { MascotComponent } from '../shared/mascot.component';

/** Entrada del personal del bar: administrador y meseros con su usuario y contraseña. */
@Component({
  selector: 'bx-login',
  standalone: true,
  imports: [FormsModule, MascotComponent],
  template: `
  <main class="wrap">
    <form class="card pad-lg box" (ngSubmit)="submit()">
      <div class="head">
        @if (ctx.venue()?.logoUrl) { <img class="logo" [src]="ctx.venue()!.logoUrl" alt=""> } @else { <bx-mascot [size]="84" mood="wink" /> }
        <div>
          <p class="kicker">Brindix</p>
          <h2>{{ ctx.name() || 'Tu bar' }}</h2>
          <p class="muted small">Entra con tu usuario de administrador o mesero.</p>
        </div>
      </div>
      @if (auth.session() && !auth.inVenue(ctx.slug())) {
        <p class="note small">Tienes una sesión abierta en otro bar ({{ auth.session()!.venueName }}). Al entrar aquí se cerrará.</p>
      }
      <label class="field"><span>Usuario</span>
        <input class="input" name="u" [(ngModel)]="username" autocomplete="username" autocapitalize="none" required>
      </label>
      <label class="field"><span>Contraseña</span>
        <input class="input" name="p" type="password" [(ngModel)]="password" autocomplete="current-password" required>
      </label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <button class="btn primary lg block" [disabled]="busy() || !username || !password">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
      <a href="/" class="back small">← Brindix</a>
    </form>
  </main>`,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px;
      background: radial-gradient(600px 400px at 20% 10%, rgba(255,79,139,.18), transparent), radial-gradient(500px 400px at 90% 90%, rgba(255,178,56,.14), transparent); }
    .box { width: 100%; max-width: 410px; display: flex; flex-direction: column; gap: 14px; }
    .head { display: flex; gap: 14px; align-items: center; margin-bottom: 6px; }
    .logo { width: 84px; height: 84px; border-radius: 20px; object-fit: cover; }
    .kicker { color: var(--pink); font-weight: 800; letter-spacing: .2em; font-size: 11px; text-transform: uppercase; }
    .err { color: #ff9a9a; font-weight: 600; font-size: 14px; }
    .note { background: var(--surface-2); border-radius: 10px; padding: 8px 12px; color: var(--muted); }
    .back { text-align: center; color: var(--muted); }
  `],
})
export class LoginComponent {
  auth = inject(Auth);
  ctx = inject(VenueContext);
  private router = inject(Router);
  username = '';
  password = '';
  busy = signal(false);
  error = signal('');

  constructor() {
    if (this.auth.inVenue(this.ctx.slug())) this.router.navigateByUrl(this.auth.home());
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.ctx.slug(), this.username.trim(), this.password);
      this.router.navigateByUrl(this.auth.home());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
