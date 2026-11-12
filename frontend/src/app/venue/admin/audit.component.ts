import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api.service';
import { AuditView } from '../../core/models';

/** Quién hizo qué: anulaciones, cambios de cantidad o precio, cobros, caja, inventario y usuarios. */
@Component({
  selector: 'bx-audit',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
  <div class="page-head">
    <div><h1>Bitácora</h1><p>Todo cambio delicado queda aquí con su autor y la hora. No se puede borrar.</p></div>
    <label class="search"><input class="input" placeholder="Buscar (mesa, producto, usuario…)" [ngModel]="q()" (ngModelChange)="q.set($event)"></label>
  </div>
  <div class="row wrap chips">
    @for (f of filters; track f.key) { <button class="chip" [class.active]="entity() === f.key" (click)="entity.set(f.key); load()">{{ f.label }}</button> }
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
      <tbody>
        @for (a of visible(); track a.id) {
          <tr><td class="nowrap muted small">{{ a.createdAt | date: 'd MMM, h:mm:ss a' }}</td><td class="strong small">{{ a.userName }}</td>
            <td><span class="badge" [class.red]="a.action.startsWith('Anul') || a.action.startsWith('Borr') || a.action === 'Merma'" [class.green]="a.action === 'Cobró' || a.action.startsWith('Recibió')">{{ a.action }}</span></td>
            <td class="small">{{ a.details }}</td></tr>
        } @empty { <tr><td colspan="4" class="muted">Sin registros.</td></tr> }
      </tbody>
    </table>
  </div>`,
  styles: ['.chips { gap: 8px; margin-bottom: 14px; }'],
})
export class AuditComponent implements OnInit {
  private api = inject(Api);
  rows = signal<AuditView[]>([]);
  q = signal('');
  entity = signal<string | null>(null);
  filters = [
    { key: null, label: 'Todo' }, { key: 'round', label: 'Pedidos' }, { key: 'payment', label: 'Cobros' },
    { key: 'cash', label: 'Caja' }, { key: 'product', label: 'Productos' }, { key: 'inventory', label: 'Inventario' }, { key: 'user', label: 'Usuarios' },
  ];
  visible = computed(() => {
    const q = this.q().toLowerCase();
    return this.rows().filter(a => !q || `${a.userName} ${a.action} ${a.details}`.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<AuditView[]>('/admin/audit', { entity: this.entity(), limit: 500 }).subscribe(r => this.rows.set(r));
  }
}
