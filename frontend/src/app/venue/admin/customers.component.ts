import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { CustomerDetail, CustomerOverview, CustomerRow, MONEY_METHODS, PAYMENT_LABELS, PaymentMethod } from '../../core/models';
import { AgoPipe, MoneyPipe, Toasts } from '../../core/ui';
import { Dialogs } from '../../shared/dialogs';
import { IconComponent } from '../../shared/icon.component';

/** Fiados: clientes con deuda, abonos y su historial. Pantalla de trabajo (modo Operate). */
@Component({
  selector: 'bx-customers',
  standalone: true,
  imports: [FormsModule, MoneyPipe, AgoPipe, IconComponent],
  template: `
  <div class="page-head">
    <div><h1>Fiados</h1><p>Lo que los clientes le deben al bar. El fiado no entra a la caja hasta que abonan en efectivo.</p></div>
    <button class="btn primary" (click)="edit()"><bx-icon name="plus" /> Nuevo cliente</button>
  </div>

  @if (data(); as d) {
    <section class="card stat glow">
      <span class="label">Total por cobrar</span><span class="value">{{ d.totalOwed | money }}</span>
      <span class="hint">{{ d.debtors }} cliente(s) con deuda</span>
    </section>

    <div class="row between wrap" style="margin: 16px 0">
      <input class="input" style="max-width: 280px" [(ngModel)]="query" placeholder="Buscar cliente">
      <label class="check"><input type="checkbox" [ngModel]="onlyDebt()" (ngModelChange)="onlyDebt.set($event)"> Solo con deuda</label>
    </div>

    <div class="col">
      @for (c of filtered(); track c.id) {
        <button class="card row between cust-row" (click)="open(c)">
          <span class="col"><b>{{ c.name }}</b><span class="muted small">{{ c.phone || 'Sin teléfono' }}@if (c.lastMovementAt) { · último movimiento {{ c.lastMovementAt | ago }} }</span></span>
          <span class="num strong" [class.amber]="c.balance > 0">{{ c.balance | money }}</span>
        </button>
      } @empty { <div class="empty"><h3>Sin clientes</h3><p>Los clientes aparecen al cobrar a fiado o al crearlos aquí.</p></div> }
    </div>
  }

  @if (detail(); as dt) {
    <div class="backdrop" (click)="detail.set(null)">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ dt.customer.name }}</h2><button class="btn icon sm" (click)="detail.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="row between">
          <span class="muted small">{{ dt.customer.phone || 'Sin teléfono' }}@if (dt.customer.note) { · {{ dt.customer.note }} }</span>
          <span class="num strong big-total">Debe {{ dt.customer.balance | money }}</span>
        </div>
        <div class="row" style="margin: 12px 0">
          <button class="btn primary" [disabled]="dt.customer.balance <= 0" (click)="startPay(dt.customer)"><bx-icon name="hand-coins" /> Registrar abono</button>
          <button class="btn" (click)="edit(dt.customer)"><bx-icon name="pencil" /> Editar</button>
          <button class="btn danger" (click)="archive(dt.customer)">Eliminar</button>
        </div>
        <div class="col">
          @for (e of dt.entries; track e.kind + e.id) {
            <div class="row between entry" [class.muted]="e.voided">
              <span class="col">
                <span><b>{{ e.kind === 'CREDIT' ? 'Fiado' : 'Abono' }}</b> · {{ e.detail }}@if (e.kind === 'PAYMENT') { · {{ label(e.method) }} } @if (e.voided) { <span class="badge red">anulado</span> }</span>
                <span class="muted small">{{ e.at | ago }} · {{ e.byName }}@if (e.note) { · {{ e.note }} }</span>
              </span>
              <span class="row">
                <span class="num strong" [class.green]="e.kind === 'PAYMENT'" [style.text-decoration]="e.voided ? 'line-through' : null">{{ e.kind === 'PAYMENT' ? '− ' : '' }}{{ e.amount | money }}</span>
                @if (e.kind === 'PAYMENT' && !e.voided) { <button class="btn xs danger" (click)="voidPayment(e.id)">Anular</button> }
              </span>
            </div>
          } @empty { <p class="muted small">Sin movimientos todavía.</p> }
        </div>
      </div>
    </div>
  }

  @if (pay(); as p) {
    <div class="backdrop" (click)="pay.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>Abono de {{ p.name }}</h2><button class="btn icon sm" (click)="pay.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <p class="muted small">Saldo actual: {{ p.balance | money }}</p>
        <div class="form-grid">
          <label class="field"><span>Monto</span><input class="input" type="number" min="1" [max]="p.balance" step="500" [(ngModel)]="payAmount"></label>
          <label class="field"><span>Nota (opcional)</span><input class="input" [(ngModel)]="payNote" maxlength="300"></label>
        </div>
        <span class="label-text">Medio de pago</span>
        <div class="row wrap">@for (m of methods; track m[0]) { <button class="chip" [class.active]="payMethod === m[0]" (click)="payMethod = m[0]">{{ m[1] }}</button> }</div>
        @if (payMethod === 'CASH') { <p class="small muted">Entra al efectivo del turno abierto.</p> }
        <div class="modal-foot">
          <button class="btn" (click)="pay.set(null)">Volver</button>
          <button class="btn primary" [disabled]="busy() || !payAmount || payAmount > p.balance" (click)="savePay(p)">Registrar abono</button>
        </div>
      </div>
    </div>
  }

  @if (form(); as f) {
    <div class="backdrop" (click)="form.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ f.id ? 'Editar cliente' : 'Nuevo cliente' }}</h2><button class="btn icon sm" (click)="form.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input class="input" [(ngModel)]="f.name" maxlength="120"></label>
          <label class="field"><span>Teléfono</span><input class="input" [(ngModel)]="f.phone" maxlength="40" inputmode="tel"></label>
          <label class="field full"><span>Nota</span><input class="input" [(ngModel)]="f.note" maxlength="300"></label>
        </div>
        <div class="modal-foot">
          <button class="btn" (click)="form.set(null)">Cancelar</button>
          <button class="btn primary" [disabled]="busy() || !f.name.trim()" (click)="save(f)">Guardar</button>
        </div>
      </div>
    </div>
  }
  `,
  styles: [`
    .cust-row { width: 100%; text-align: left; cursor: pointer; padding: 12px 16px; transition: transform 140ms cubic-bezier(.23, 1, .32, 1); }
    .cust-row:active { transform: scale(.985); }
    @media (hover: hover) and (pointer: fine) { .cust-row:hover { background: var(--hover); } }
    .entry { padding: 8px 0; border-bottom: 1px solid var(--hover); }
    .green { color: var(--c-green, inherit); }
    .amber { color: var(--c-amber, inherit); }
  `],
})
export class CustomersComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private dialogs = inject(Dialogs);

  data = signal<CustomerOverview | null>(null);
  detail = signal<CustomerDetail | null>(null);
  form = signal<{ id?: number; name: string; phone: string; note: string } | null>(null);
  pay = signal<CustomerRow | null>(null);
  busy = signal(false);
  onlyDebt = signal(false);
  query = '';
  payAmount: number | null = null;
  payMethod: PaymentMethod = 'CASH';
  payNote = '';
  methods = MONEY_METHODS;

  visible = computed(() => {
    const list = this.data()?.customers ?? [];
    return this.onlyDebt() ? list.filter(c => c.balance > 0) : list;
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.get<CustomerOverview>('/admin/customers').subscribe(d => this.data.set(d));
  }

  label(m: PaymentMethod): string {
    return PAYMENT_LABELS[m] ?? m;
  }

  filtered(): CustomerRow[] {
    const q = this.query.trim().toLowerCase();
    return q ? this.visible().filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)) : this.visible();
  }

  open(c: CustomerRow): void {
    this.api.get<CustomerDetail>(`/admin/customers/${c.id}`).subscribe(d => this.detail.set(d));
  }

  edit(c?: CustomerRow): void {
    this.form.set({ id: c?.id, name: c?.name ?? '', phone: c?.phone ?? '', note: c?.note ?? '' });
  }

  async save(f: { id?: number; name: string; phone: string; note: string }): Promise<void> {
    this.busy.set(true);
    try {
      const body = { name: f.name.trim(), phone: f.phone.trim() || null, note: f.note.trim() || null };
      if (f.id) await this.api.run(this.api.put(`/admin/customers/${f.id}`, body));
      else await this.api.run(this.api.post('/admin/customers', body));
      this.form.set(null);
      this.toasts.ok('Cliente guardado');
      this.reload();
      if (f.id && this.detail()) this.open({ id: f.id } as CustomerRow);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async archive(c: CustomerRow): Promise<void> {
    if (!(await this.dialogs.confirm({ title: '¿Eliminar cliente?', message: 'Sale de la lista; su historial se conserva. Solo se puede si no debe nada.', confirm: 'Eliminar cliente', tone: 'danger' }))) return;
    try {
      await this.api.run(this.api.delete(`/admin/customers/${c.id}`));
      this.detail.set(null);
      this.toasts.ok('Cliente eliminado');
      this.reload();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  startPay(c: CustomerRow): void {
    this.payAmount = c.balance;
    this.payMethod = 'CASH';
    this.payNote = '';
    this.pay.set(c);
  }

  async savePay(c: CustomerRow): Promise<void> {
    this.busy.set(true);
    try {
      const d = await this.api.run(this.api.post<CustomerDetail>(`/admin/customers/${c.id}/payments`,
        { amount: Number(this.payAmount), method: this.payMethod, note: this.payNote.trim() || null }));
      this.detail.set(d);
      this.pay.set(null);
      this.toasts.ok('Abono registrado');
      this.reload();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async voidPayment(id: number): Promise<void> {
    if (!(await this.dialogs.confirm({ title: '¿Anular el abono?', message: 'La deuda vuelve a subir y, si fue en efectivo, se revierte en la caja.', confirm: 'Anular abono', tone: 'danger' }))) return;
    try {
      const d = await this.api.run(this.api.post<CustomerDetail>(`/admin/customer-payments/${id}/void`));
      this.detail.set(d);
      this.toasts.ok('Abono anulado');
      this.reload();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
