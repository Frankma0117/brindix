import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api.service';
import { AdminVenue } from '../core/models';
import { Toasts } from '../core/ui';

@Component({
  selector: 'bx-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="page-head"><div><h1>Ajustes</h1><p>Datos del bar, pedidos desde el QR y reglas de la música.</p></div></div>

  @if (v(); as v) {
    <div class="grid cols-2">
      <div class="card pad-lg col">
        <h3>El bar</h3>
        <label class="field"><span>Nombre</span><input class="input" [(ngModel)]="v.name"></label>
        <label class="field"><span>Frase</span><input class="input" [(ngModel)]="v.tagline" placeholder="Buena música, mejores tragos"></label>
        <div class="form-grid">
          <label class="field"><span>Wi-Fi (nombre)</span><input class="input" [(ngModel)]="v.wifiName"></label>
          <label class="field"><span>Wi-Fi (clave)</span><input class="input" [(ngModel)]="v.wifiPassword"></label>
        </div>
      </div>
      <div class="card pad-lg col">
        <h3>Clientes</h3>
        <label class="check"><input type="checkbox" [(ngModel)]="v.clientOrdersEnabled"> Los clientes pueden pedir desde el QR</label>
        <p class="tiny muted">Los pedidos llegan al mesero para confirmar; solo entonces se suman a la cuenta.</p>
        <div class="divider"></div>
        <h3>Música</h3>
        <label class="check"><input type="checkbox" [(ngModel)]="v.musicEnabled"> Los clientes pueden pedir canciones</label>
        <label class="check"><input type="checkbox" [(ngModel)]="v.songApproval"> Aprobar cada canción antes de que entre a la cola</label>
        <label class="field"><span>Máximo de canciones en lista por mesa</span><input class="input" type="number" min="1" max="20" [(ngModel)]="v.maxSongsPerTable"></label>
      </div>
    </div>
    <div class="row" style="margin-top: 16px"><button class="btn primary lg" (click)="save()">Guardar ajustes</button></div>

    <div class="card pad-lg col pw">
      <h3>Mi contraseña</h3>
      <div class="form-grid">
        <label class="field"><span>Actual</span><input class="input" type="password" [(ngModel)]="current"></label>
        <label class="field"><span>Nueva (mínimo 8)</span><input class="input" type="password" [(ngModel)]="next"></label>
      </div>
      <div><button class="btn" [disabled]="!current || next.length < 8" (click)="changePassword()">Cambiar contraseña</button></div>
    </div>
  }`,
  styles: ['.pw { margin-top: 24px; max-width: 640px; }'],
})
export class SettingsComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  v = signal<AdminVenue | null>(null);
  current = '';
  next = '';

  ngOnInit(): void {
    this.api.get<AdminVenue>('/admin/venue').subscribe(v => this.v.set(v));
  }

  async save(): Promise<void> {
    try {
      this.v.set(await this.api.run(this.api.put<AdminVenue>('/admin/venue', this.v())));
      this.toasts.ok('Ajustes guardados');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async changePassword(): Promise<void> {
    try {
      await this.api.run(this.api.post('/auth/password', { current: this.current, next: this.next }));
      this.current = '';
      this.next = '';
      this.toasts.ok('Contraseña cambiada');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
