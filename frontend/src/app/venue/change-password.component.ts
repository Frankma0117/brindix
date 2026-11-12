import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { VenueContext } from '../core/venue-context';
import { MascotComponent } from '../shared/mascot.component';
import { ThemeToggleComponent } from '../core/theme';

/** Primer ingreso (o clave puesta por otra persona): hay que cambiarla antes de seguir. */
@Component({
  selector: 'bx-change-password',
  standalone: true,
  imports: [FormsModule, MascotComponent, ThemeToggleComponent],
  template: `
  <bx-theme-toggle class="theme-corner" />
  <main class="wrap">
    <form class="card pad-lg box" (ngSubmit)="submit()">
      <div class="head">
        <bx-mascot [size]="72" mood="wink" />
        <div>
          <h2>Crea tu contraseña</h2>
          <p class="muted small">{{ ctx.name() }} · Hola {{ auth.user()?.name }}. Estás entrando con una clave temporal: cámbiala por una que solo tú conozcas.</p>
        </div>
      </div>
      <label class="field"><span>Contraseña actual (la temporal)</span>
        <input class="input" name="c" type="password" [(ngModel)]="current" autocomplete="current-password" required>
      </label>
      <label class="field"><span>Nueva contraseña (mínimo 8)</span>
        <input class="input" name="n" type="password" [(ngModel)]="next" autocomplete="new-password" minlength="8" required>
      </label>
      <label class="field"><span>Repite la nueva</span>
        <input class="input" name="r" type="password" [(ngModel)]="repeat" autocomplete="new-password" required>
      </label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <button class="btn primary lg block" [disabled]="busy() || !current || next.length < 8 || !repeat">{{ busy() ? 'Guardando…' : 'Guardar y entrar' }}</button>
      <button type="button" class="btn ghost sm" (click)="auth.logout()">Salir</button>
    </form>
  </main>`,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px;
      background: radial-gradient(600px 400px at 20% 10%, rgba(255,79,139,.18), transparent), radial-gradient(500px 400px at 90% 90%, rgba(255,178,56,.14), transparent); }
    .box { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; }
    .head { display: flex; gap: 14px; align-items: center; margin-bottom: 6px; }
    .err { color: var(--ink-red); font-weight: 600; font-size: 14px; }
  `],
})
export class ChangePasswordComponent {
  auth = inject(Auth);
  ctx = inject(VenueContext);
  private router = inject(Router);
  current = '';
  next = '';
  repeat = '';
  busy = signal(false);
  error = signal('');

  async submit(): Promise<void> {
    if (this.next !== this.repeat) { this.error.set('Las dos contraseñas nuevas no coinciden'); return; }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.changePassword(this.current, this.next);
      this.router.navigateByUrl(this.auth.home());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
