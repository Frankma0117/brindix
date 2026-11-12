import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { Role, User } from '../../core/models';
import { Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { IconComponent } from '../../shared/icon.component';

interface UserForm { id?: number; name: string; username: string; password: string; role: Role; active: boolean; }

@Component({
  selector: 'bx-users',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
  template: `
  <div class="page-head">
    <div><h1>Equipo</h1><p>Entran en <b>{{ loginUrl() }}</b> con su usuario y contraseña.</p></div>
    <button class="btn primary" (click)="edit()"><bx-icon name="plus" /> Nuevo usuario</button>
  </div>
  <div class="grid cols-2 roles">
    <div class="card"><h3><bx-icon name="crown" /> Administrador</h3><p class="small muted">Todo: carta, precios y costos, inventario, caja y cierres, cobros, descuentos, modificar o anular pedidos, música, equipo y configuración. También puede atender mesas.</p></div>
    <div class="card"><h3><bx-icon name="user" /> Mesero</h3><p class="small muted">Ve las mesas y la carta, carga rondas, entrega lo que le asignan y, si lo permites en Configuración, cobra (el dinero queda a su nombre hasta entregarlo en caja). No modifica nada.</p></div>
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Nombre</th><th>Usuario</th><th>Perfil</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
      <tbody>
        @for (u of users(); track u.id) {
          <tr>
            <td class="strong">{{ u.name }}</td><td class="muted">{{ u.username }}</td>
            <td><span class="badge" [class.amber]="u.role === 'ADMIN'" [class.teal]="u.role === 'WAITER'">{{ u.role === 'ADMIN' ? 'Administrador' : 'Mesero' }}</span></td>
            <td><span class="badge" [class.green]="u.active" [class.red]="!u.active">{{ u.active ? 'Activo' : 'Inactivo' }}</span></td>
            <td class="muted small">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'd MMM, h:mm a') : 'Nunca' }}</td>
            <td class="right"><button class="btn xs" (click)="edit(u)">Editar</button></td>
          </tr>
        }
      </tbody>
    </table>
  </div>

  @if (form(); as f) {
    <div class="backdrop" (click)="form.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ f.id ? 'Editar usuario' : 'Nuevo usuario' }}</h2><button class="btn icon sm" (click)="form.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="form-grid">
          <label class="field full"><span>Nombre</span><input class="input" [(ngModel)]="f.name"></label>
          <label class="field"><span>Usuario</span><input class="input" [(ngModel)]="f.username" [disabled]="!!f.id" autocapitalize="none"></label>
          <label class="field"><span>{{ f.id ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</span><input class="input" type="password" [(ngModel)]="f.password" placeholder="Mínimo 8 caracteres"></label>
          <div class="field full"><span>Perfil</span>
            <div class="row"><button class="chip" [class.active]="f.role === 'WAITER'" (click)="f.role = 'WAITER'">Mesero</button><button class="chip" [class.active]="f.role === 'ADMIN'" (click)="f.role = 'ADMIN'">Administrador</button></div>
          </div>
          @if (f.id) { <label class="check full"><input type="checkbox" [(ngModel)]="f.active"> Activo (si lo desactivas, pierde el acceso al instante)</label> }
        </div>
        <div class="modal-foot"><button class="btn" (click)="form.set(null)">Cancelar</button><button class="btn primary" (click)="save()">Guardar</button></div>
      </div>
    </div>
  }`,
  styles: ['.roles { margin-bottom: 16px; }'],
})
export class UsersComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private ctx = inject(VenueContext);
  users = signal<User[]>([]);
  form = signal<UserForm | null>(null);

  loginUrl(): string {
    return `${location.host}/${this.ctx.slug()}`;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<User[]>('/admin/users').subscribe(u => this.users.set(u));
  }

  edit(u?: User): void {
    this.form.set(u ? { id: u.id, name: u.name, username: u.username, password: '', role: u.role, active: u.active }
      : { name: '', username: '', password: '', role: 'WAITER', active: true });
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    try {
      if (f.id) await this.api.run(this.api.put(`/admin/users/${f.id}`, { name: f.name, role: f.role, active: f.active, password: f.password || null }));
      else await this.api.run(this.api.post('/admin/users', { name: f.name, username: f.username, password: f.password, role: f.role }));
      this.toasts.ok('Usuario guardado');
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
