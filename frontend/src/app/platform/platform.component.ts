import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api.service';
import { Router } from '@angular/router';
import { Auth, PlatformAuth, StaffSession } from '../core/auth.service';
import { PlatformVenue } from '../core/models';
import { Toasts } from '../core/ui';
import { MascotComponent } from '../shared/mascot.component';
import { ResetRequestsComponent } from '../shared/reset-requests.component';
import { ThemeToggleComponent } from '../core/theme';
import { Dialogs } from '../shared/dialogs';

interface VenueForm {
  id?: number; name: string; slug: string; contactName: string; contactPhone: string; active: boolean;
  adminName: string; adminUsername: string; adminPassword: string; sampleMenu: boolean;
}

/** Panel del dueño de Brindix: crea bares, los suspende y recupera el acceso del administrador. */
@Component({
  selector: 'bx-platform',
  standalone: true,
  imports: [FormsModule, DatePipe, MascotComponent, ThemeToggleComponent, ResetRequestsComponent],
  template: `
  @if (!auth.session() || auth.session()!.mustChangePassword || changing()) { <bx-theme-toggle class="theme-corner" /> }
  @if (!auth.session() && recovering()) {
    <main class="login-wrap">
      <form class="card pad-lg box" (ngSubmit)="recover()">
        <div><h2>Recuperar acceso</h2><p class="muted small">Súper administrador de Brindix.</p></div>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [class.on]="via() === 'mail'" (click)="via.set('mail'); error.set('')">Código por correo</button>
          <button type="button" role="tab" [class.on]="via() === 'key'" (click)="via.set('key'); error.set('')">Clave del servidor</button>
        </div>
        <label class="field"><span>Usuario</span><input class="input" name="ru" [(ngModel)]="username" autocomplete="username" autocapitalize="none"></label>
        @if (via() === 'mail') {
          @if (!mailSent()) {
            <p class="small muted">Te enviamos un código de un solo uso al correo registrado del súper administrador. Vence en 15 minutos.</p>
            @if (error()) { <p class="err">{{ error() }}</p> }
            <button type="button" class="btn primary lg block" [disabled]="busy() || !username" (click)="sendCode()">Enviarme el código</button>
          } @else {
            <p class="small ok-msg">{{ mailSent() }}</p>
            <label class="field"><span>Código del correo</span><input class="input code" name="rc" [(ngModel)]="code" autocomplete="one-time-code" placeholder="ABCD-2345" maxlength="12"></label>
          }
        } @else {
          <p class="small muted">Está en el servidor: archivo <code>/opt/brindix/.env</code>, variable <code>BRINDIX_RECOVERY_KEY</code>.</p>
          <label class="field"><span>Clave de recuperación</span><input class="input" name="rk" type="password" [(ngModel)]="recoveryKey" autocomplete="off"></label>
        }
        @if (via() === 'key' || mailSent()) {
          <label class="field"><span>Nueva contraseña (mínimo 8)</span><input class="input" name="rn" type="password" [(ngModel)]="next" autocomplete="new-password"></label>
          <label class="field"><span>Repite la nueva</span><input class="input" name="rr" type="password" [(ngModel)]="repeat" autocomplete="new-password"></label>
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn primary lg block" [disabled]="busy() || !username || (via() === 'key' ? !recoveryKey : code.trim().length < 8) || next.length < 8 || !repeat">Restablecer</button>
        }
        <button type="button" class="btn ghost sm" (click)="recovering.set(false); error.set('')">Volver</button>
        <p class="tiny muted">Al restablecerla se cierran todas las sesiones abiertas.</p>
      </form>
    </main>
  } @else if (!auth.session()) {
    <main class="login-wrap">
      <form class="card pad-lg box" (ngSubmit)="login()">
        <div class="row"><bx-mascot [size]="70" mood="wink" /><div><h2>Plataforma Brindix</h2><p class="muted small">Acceso del administrador del servicio.</p></div></div>
        <label class="field"><span>Usuario</span><input class="input" name="u" [(ngModel)]="username" autocomplete="username" autocapitalize="none"></label>
        <label class="field"><span>Contraseña</span><input class="input" name="p" type="password" [(ngModel)]="password" autocomplete="current-password"></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button class="btn primary lg block" [disabled]="busy() || !username || !password">Entrar</button>
        <button type="button" class="btn ghost sm" (click)="recovering.set(true); error.set('')">¿Olvidaste tu contraseña?</button>
      </form>
    </main>
  } @else if (auth.session()!.mustChangePassword || changing()) {
    <main class="login-wrap">
      <form class="card pad-lg box" (ngSubmit)="changePassword()">
        <div class="row"><bx-mascot [size]="70" mood="wink" /><div><h2>{{ auth.session()!.mustChangePassword ? 'Crea tu contraseña' : 'Cambiar contraseña' }}</h2>
          <p class="muted small">@if (auth.session()!.mustChangePassword) { Entraste con la clave inicial: cámbiala por una que solo tú conozcas. } @else { Mínimo 8 caracteres. }</p></div></div>
        <label class="field"><span>Contraseña actual</span><input class="input" name="c" type="password" [(ngModel)]="current" autocomplete="current-password"></label>
        <label class="field"><span>Nueva contraseña (mínimo 8)</span><input class="input" name="n" type="password" [(ngModel)]="next" autocomplete="new-password"></label>
        <label class="field"><span>Repite la nueva</span><input class="input" name="r" type="password" [(ngModel)]="repeat" autocomplete="new-password"></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button class="btn primary lg block" [disabled]="busy() || !current || next.length < 8 || !repeat">Guardar</button>
        @if (!auth.session()!.mustChangePassword) { <button type="button" class="btn ghost sm" (click)="changing.set(false)">Cancelar</button> }
        @else { <button type="button" class="btn ghost sm" (click)="auth.logout()">Salir</button> }
      </form>
    </main>
  } @else {
    <header class="top">
      <div class="container row between">
        <div class="row"><bx-mascot [size]="38" [animate]="false" /><b class="brand">Brindix · Plataforma</b></div>
        <div class="row"><span class="muted small">{{ auth.session()!.name }}</span><bx-theme-toggle /><button class="btn ghost sm" (click)="changing.set(true)">Mi contraseña</button><button class="btn ghost sm" (click)="auth.logout()">Salir</button></div>
      </div>
    </header>
    <main class="container wrap-p">
      <div class="page-head">
        <div><h1>Bares</h1><p>Cada bar tiene su dirección, su administrador y sus datos separados.</p></div>
        <button class="btn primary" (click)="newVenue()">＋ Nuevo bar</button>
      </div>
      <div class="card mail-row">
        <div class="grow"><b>Correo de Brindix</b>
          <p class="small muted">@if (mailInfo()?.enabled) { Envía desde {{ mailInfo()!.from }}. Avisos y recuperación a {{ mailInfo()!.adminEmail || 'sin correo de administrador' }}. } @else { Sin configurar: los códigos de recuperación no se envían por correo. }</p></div>
        <button class="btn sm" [disabled]="!mailInfo()?.enabled || busy()" (click)="mailTest()">Enviar correo de prueba</button>
      </div>
      <bx-reset-requests base="/platform" [showVenue]="true" />
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Bar</th><th>Dirección</th><th>Administrador</th><th>Contacto</th><th>Usuarios</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
          <tbody>
            @for (v of venues(); track v.id) {
              <tr>
                <td class="strong">{{ v.name }}</td>
                <td><a [href]="'/' + v.slug + '/ingresar'" target="_blank">/{{ v.slug }}</a></td>
                <td class="muted">{{ v.admin }}</td>
                <td class="muted small">{{ v.contactName }} {{ v.contactPhone }}</td>
                <td>{{ v.users }}</td>
                <td><span class="badge" [class.green]="v.active" [class.red]="!v.active">{{ v.active ? 'Activo' : 'Suspendido' }}</span></td>
                <td class="muted small">{{ v.createdAt | date: 'd MMM y' }}</td>
                <td class="right nowrap">
                  <button class="btn xs primary" [disabled]="!v.active" (click)="enter(v)" title="Entrar al bar como su administrador para revisar">Entrar</button>
                  <button class="btn xs" (click)="edit(v)">Editar</button>
                  <button class="btn xs" (click)="resetAdmin(v)">Clave admin</button>
                </td>
              </tr>
            } @empty { <tr><td colspan="8" class="muted">Aún no hay bares.</td></tr> }
          </tbody>
        </table>
      </div>
    </main>

    @if (form(); as f) {
      <div class="backdrop" (click)="form.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head"><h2>{{ f.id ? 'Editar bar' : 'Nuevo bar' }}</h2><button class="btn icon sm" (click)="form.set(null)">✕</button></div>
          <div class="form-grid">
            <label class="field full"><span>Nombre del bar</span><input class="input" [(ngModel)]="f.name" (ngModelChange)="!f.id && autoSlug(f)"></label>
            @if (!f.id) {
              <label class="field full"><span>Dirección</span>
                <div class="slug"><span>brindix.cania.app/</span><input class="input" [(ngModel)]="f.slug" placeholder="mi-bar"></div>
              </label>
            }
            <label class="field"><span>Contacto</span><input class="input" [(ngModel)]="f.contactName"></label>
            <label class="field"><span>Teléfono</span><input class="input" [(ngModel)]="f.contactPhone"></label>
            @if (!f.id) {
              <h3 class="full sec">Primer administrador</h3>
              <label class="field"><span>Nombre</span><input class="input" [(ngModel)]="f.adminName"></label>
              <label class="field"><span>Usuario</span><input class="input" [(ngModel)]="f.adminUsername" autocapitalize="none"></label>
              <label class="field full"><span>Contraseña (mínimo 8)</span><input class="input" [(ngModel)]="f.adminPassword"></label>
              <label class="check full"><input type="checkbox" [(ngModel)]="f.sampleMenu"> Crear con carta, mesas y banners de ejemplo</label>
            } @else {
              <label class="check full"><input type="checkbox" [(ngModel)]="f.active"> Activo (si lo suspendes, nadie del bar puede entrar)</label>
            }
          </div>
          <div class="modal-foot">
            <button class="btn" (click)="form.set(null)">Cancelar</button>
            <button class="btn primary" [disabled]="busy()" (click)="save()">Guardar</button>
          </div>
        </div>
      </div>
    }
  }`,
  styles: [`
    .login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; background: radial-gradient(600px 400px at 30% 10%, rgba(255,178,56,.14), transparent); }
    .box { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; }
    .err { color: var(--ink-red); font-weight: 600; }
    .mail-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: var(--bg-2); }
    .tabs button { height: 38px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font: 700 14px var(--font); cursor: pointer; }
    .tabs button.on { background: var(--surface-3); color: var(--text); }
    .code { letter-spacing: .14em; text-transform: uppercase; font-weight: 800; }
    .ok-msg { color: var(--ink-green); font-weight: 650; }
    .top { border-bottom: 1px solid var(--line); padding: 12px 0; background: var(--bg-2); }
    .brand { font-size: 18px; }
    .wrap-p { padding-top: 26px; padding-bottom: 60px; }
    .sec { margin-top: 6px; font-size: 15px; color: var(--c-amber); }
    .slug { display: flex; align-items: center; border: 1px solid var(--line-2); border-radius: 12px; background: var(--bg-2); }
    .slug span { padding-left: 14px; color: var(--faint); font-size: 14px; white-space: nowrap; }
    .slug .input { border: 0; background: transparent; padding-left: 2px; }
  `],
})
export class PlatformComponent implements OnInit {
  private dialogs = inject(Dialogs);
  auth = inject(PlatformAuth);
  private staffAuth = inject(Auth);
  private router = inject(Router);
  private api = inject(Api);
  private toasts = inject(Toasts);
  username = '';
  password = '';
  current = '';
  next = '';
  repeat = '';
  changing = signal(false);
  recovering = signal(false);
  recoveryKey = '';
  via = signal<'mail' | 'key'>('mail');
  mailSent = signal('');
  code = '';
  busy = signal(false);
  error = signal('');
  venues = signal<PlatformVenue[]>([]);
  form = signal<VenueForm | null>(null);

  ngOnInit(): void {
    if (this.auth.session() && !this.auth.session()!.mustChangePassword) this.load();
  }

  async login(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.username.trim(), this.password);
      if (!this.auth.session()!.mustChangePassword) this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.next !== this.repeat) { this.error.set('Las dos contraseñas nuevas no coinciden'); return; }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.changePassword(this.current, this.next);
      this.current = this.next = this.repeat = '';
      this.changing.set(false);
      this.toasts.ok('Contraseña cambiada');
      this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async sendCode(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.run(this.api.post<{ message: string }>('/platform/forgot', { username: this.username.trim() }));
      this.mailSent.set(r.message);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async recover(): Promise<void> {
    if (this.next !== this.repeat) { this.error.set('Las dos contraseñas nuevas no coinciden'); return; }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.via() === 'key') await this.api.run(this.api.post('/platform/recover', { username: this.username.trim(), recoveryKey: this.recoveryKey, next: this.next, temporary: false }));
      else await this.api.run(this.api.post('/platform/reset-code', { username: this.username.trim(), code: this.code, next: this.next }));
      this.toasts.ok('Contraseña restablecida. Entra con la nueva.');
      this.recovering.set(false);
      this.recoveryKey = this.next = this.repeat = this.password = this.code = '';
      this.mailSent.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Modo soporte: entra al bar como su administrador (queda en la bitácora del bar). */
  async enter(v: PlatformVenue): Promise<void> {
    try {
      const s = await this.api.run(this.api.post<StaffSession>(`/platform/venues/${v.id}/enter`, {}));
      this.staffAuth.use(s);
      this.router.navigateByUrl(`/${s.venue}/admin`);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  mailInfo = signal<{ enabled: boolean; from: string; adminEmail: string } | null>(null);

  async mailTest(): Promise<void> {
    try { const r = await this.api.run(this.api.post<{ message: string }>('/platform/mail/test', {})); this.toasts.ok(r.message); }
    catch (e) { this.toasts.error(errorMessage(e)); }
  }

  load(): void {
    this.api.get<{ enabled: boolean; from: string; adminEmail: string }>('/platform/mail').subscribe({ next: m => this.mailInfo.set(m), error: () => {} });
    this.api.get<PlatformVenue[]>('/platform/venues').subscribe(v => this.venues.set(v));
  }

  newVenue(): void {
    this.form.set({ name: '', slug: '', contactName: '', contactPhone: '', active: true, adminName: 'Administrador', adminUsername: 'admin', adminPassword: '', sampleMenu: true });
  }

  edit(v: PlatformVenue): void {
    this.form.set({ id: v.id, name: v.name, slug: v.slug, contactName: v.contactName ?? '', contactPhone: v.contactPhone ?? '', active: v.active,
      adminName: '', adminUsername: '', adminPassword: '', sampleMenu: false });
  }

  autoSlug(f: VenueForm): void {
    f.slug = f.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    this.busy.set(true);
    try {
      if (f.id) await this.api.run(this.api.put(`/platform/venues/${f.id}`, f));
      else await this.api.run(this.api.post('/platform/venues', f));
      this.toasts.ok(f.id ? 'Bar actualizado' : `Bar creado: /${f.slug}`);
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async resetAdmin(v: PlatformVenue): Promise<void> {
    const password = await this.dialogs.prompt({ title: `Contraseña temporal para ${v.name}`, icon: 'lock',
      message: 'El administrador del bar deberá cambiarla al entrar. Se cierran sus sesiones abiertas.', confirm: 'Guardar contraseña',
      input: { label: 'Contraseña temporal', type: 'password', minLength: 8, hint: 'Mínimo 8 caracteres.' } });
    if (!password) return;
    try {
      await this.api.run(this.api.post(`/platform/venues/${v.id}/reset-admin`, { password }));
      this.toasts.ok('Contraseña cambiada');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
