import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, errorMessage } from '../core/api.service';
import { ThemeToggleComponent } from '../core/theme';
import { Toasts } from '../core/ui';
import { VenueContext } from '../core/venue-context';
import { IconComponent } from '../shared/icon.component';

/**
 * ¿Olvidaste tu contraseña? (personal del bar)
 * Paso 1: pedir (avisa al administrador). Paso 2: con el código que te da, elegir la nueva contraseña.
 */
@Component({
  selector: 'bx-recover',
  standalone: true,
  imports: [FormsModule, RouterLink, ThemeToggleComponent, IconComponent],
  template: `
  <bx-theme-toggle class="theme-corner" />
  <main class="wrap">
    <div class="card pad-lg box">
      <a class="back small" [routerLink]="'/' + ctx.slug() + '/ingresar'"><bx-icon name="arrow-left" /> Volver a ingresar</a>
      <div>
        <h2>Recuperar tu contraseña</h2>
        <p class="muted small">{{ ctx.name() }}</p>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" [class.on]="step() === 'ask'" (click)="step.set('ask')">Pedir código</button>
        <button role="tab" [class.on]="step() === 'code'" (click)="step.set('code')">Ya tengo un código</button>
      </div>

      @if (step() === 'ask') {
        @if (sent()) {
          <p class="ok"><bx-icon name="circle-check" /> {{ sent() }}</p>
          <p class="small muted">El administrador del bar verá tu solicitud en <b>Equipo</b>. Si eres el único administrador, la aprueba Brindix. Cuando te den el código, entra a <b>Ya tengo un código</b>.</p>
          <button class="btn block" (click)="step.set('code')">Ya tengo un código</button>
        } @else {
          <form class="col" (ngSubmit)="ask()">
            <p class="small muted">Escribe tu usuario. Le avisamos al administrador para que confirme que eres tú y te dé un código de un solo uso.</p>
            <label class="field"><span>Usuario</span><input class="input" name="u" [(ngModel)]="username" autocomplete="username" autocapitalize="none" required></label>
            @if (error()) { <p class="err">{{ error() }}</p> }
            <button class="btn primary lg block" [disabled]="busy() || !username.trim()">Pedir código</button>
          </form>
        }
      } @else {
        <form class="col" (ngSubmit)="reset()">
          <label class="field"><span>Usuario</span><input class="input" name="u2" [(ngModel)]="username" autocomplete="username" autocapitalize="none" required></label>
          <label class="field"><span>Código (8 letras y números)</span><input class="input code" name="c" [(ngModel)]="code" autocomplete="one-time-code" autocapitalize="characters" placeholder="ABCD-2345" maxlength="12" required></label>
          <label class="field"><span>Nueva contraseña (mínimo 8)</span><input class="input" name="n" type="password" [(ngModel)]="next" autocomplete="new-password" minlength="8" required></label>
          <label class="field"><span>Repite la nueva</span><input class="input" name="r" type="password" [(ngModel)]="repeat" autocomplete="new-password" required></label>
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn primary lg block" [disabled]="busy() || !username.trim() || code.trim().length < 8 || next.length < 8 || !repeat">Guardar contraseña</button>
          <p class="tiny muted">Al cambiarla se cierran las sesiones abiertas en otros dispositivos.</p>
        </form>
      }
    </div>
  </main>`,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .box { width: 100%; max-width: 430px; display: flex; flex-direction: column; gap: 16px; }
    .back { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); }
    .tabs button { height: 38px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: 700 14px var(--font); cursor: pointer; }
    .tabs button.on { background: var(--surface-3); color: var(--text); }
    .col { display: flex; flex-direction: column; gap: 14px; }
    .code { letter-spacing: .14em; text-transform: uppercase; font-weight: 800; }
    .err { color: var(--ink-red); font-weight: 600; font-size: 14px; }
    .ok { display: flex; gap: 8px; color: var(--ink-green); font-weight: 650; }
  `],
})
export class RecoverComponent {
  ctx = inject(VenueContext);
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  step = signal<'ask' | 'code'>(inject(ActivatedRoute).snapshot.queryParamMap.get('codigo') ? 'code' : 'ask');
  username = '';
  code = '';
  next = '';
  repeat = '';
  busy = signal(false);
  error = signal('');
  sent = signal('');

  async ask(): Promise<void> {
    await this.run(async () => {
      const r = await firstValueFrom(this.api.post<{ message: string }>('/auth/forgot', { venue: this.ctx.slug(), username: this.username.trim() }));
      this.sent.set(r.message);
    });
  }

  async reset(): Promise<void> {
    if (this.next !== this.repeat) { this.error.set('Las dos contraseñas no coinciden'); return; }
    await this.run(async () => {
      const r = await firstValueFrom(this.api.post<{ message: string }>('/auth/reset', {
        venue: this.ctx.slug(), username: this.username.trim(), code: this.code.trim(), next: this.next,
      }));
      this.toasts.ok(r.message);
      this.router.navigate(['/', this.ctx.slug(), 'ingresar']);
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try { await fn(); } catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
}
