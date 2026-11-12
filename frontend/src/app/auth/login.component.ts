import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { MascotComponent } from '../shared/mascot.component';

@Component({
  selector: 'bx-login',
  standalone: true,
  imports: [FormsModule, RouterLink, MascotComponent],
  template: `
  <main class="wrap">
    <form class="card pad-lg box" (ngSubmit)="submit()">
      <div class="head">
        <bx-mascot [size]="84" mood="wink" />
        <div>
          <h2>Hola, equipo</h2>
          <p class="muted small">Entra con tu usuario de mesero o administrador.</p>
        </div>
      </div>
      <label class="field"><span>Usuario</span>
        <input class="input" name="u" [(ngModel)]="username" autocomplete="username" autocapitalize="none" required>
      </label>
      <label class="field"><span>Contraseña</span>
        <input class="input" name="p" type="password" [(ngModel)]="password" autocomplete="current-password" required>
      </label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <button class="btn primary lg block" [disabled]="busy() || !username || !password">
        {{ busy() ? 'Entrando…' : 'Entrar' }}
      </button>
      <a routerLink="/" class="back small">← Volver al inicio</a>
    </form>
  </main>`,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px;
      background: radial-gradient(600px 400px at 20% 10%, rgba(255,79,139,.18), transparent), radial-gradient(500px 400px at 90% 90%, rgba(255,178,56,.14), transparent); }
    .box { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 14px; }
    .head { display: flex; gap: 14px; align-items: center; margin-bottom: 6px; }
    .err { color: #ff9a9a; font-weight: 600; font-size: 14px; }
    .back { text-align: center; color: var(--muted); }
  `],
})
export class LoginComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  username = '';
  password = '';
  busy = signal(false);
  error = signal('');

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.username.trim(), this.password);
      this.router.navigateByUrl(this.auth.home());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
