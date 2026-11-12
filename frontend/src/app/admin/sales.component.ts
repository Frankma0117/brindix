import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { PAYMENT_LABELS, PaymentMethod, Summary, TabView } from '../core/models';
import { MoneyPipe } from '../core/ui';

@Component({
  selector: 'bx-sales',
  standalone: true,
  imports: [FormsModule, MoneyPipe, DatePipe],
  template: `
  <div class="page-head">
    <div><h1>Ventas</h1><p>El día contable va de 6:00 a. m. a 6:00 a. m. (la noche cuenta completa).</p></div>
    <div class="row wrap">
      <input class="input" type="date" [(ngModel)]="from" style="width: 160px">
      <input class="input" type="date" [(ngModel)]="to" style="width: 160px">
      <button class="btn primary" (click)="load()">Ver</button>
    </div>
  </div>
  <div class="row wrap quick">
    <button class="chip" (click)="range(0)">Hoy</button>
    <button class="chip" (click)="range(1)">Ayer</button>
    <button class="chip" (click)="range(6)">7 días</button>
    <button class="chip" (click)="range(29)">30 días</button>
  </div>

  @if (s(); as s) {
    <section class="grid cols-4">
      <div class="card stat glow"><span class="label">Ventas</span><span class="value grad-text">{{ s.totals.sales | money }}</span><span class="hint">{{ s.totals.tabs }} cuentas</span></div>
      <div class="card stat"><span class="label">Ticket promedio</span><span class="value">{{ s.totals.averageTicket | money }}</span></div>
      <div class="card stat"><span class="label">Propinas / descuentos</span><span class="value">{{ s.totals.tips | money }}</span><span class="hint">Descuentos {{ s.totals.discounts | money }}</span></div>
      <div class="card stat"><span class="label">Margen aprox.</span><span class="value">{{ s.totals.estimatedMargin | money }}</span><span class="hint">Costo {{ s.totals.estimatedCost | money }}</span></div>
    </section>

    <section class="grid cols-2 mt">
      <div class="card">
        <h3>Por día</h3>
        <div class="chart">
          @for (b of s.byDay; track b.key) {
            <div class="colbar" [title]="b.key + ': ' + (b.total | money)">
              <span class="v">{{ short(b.total) }}</span>
              <i [style.height.%]="(b.total / maxDay()) * 100"></i>
              <span class="k">{{ b.key.slice(5) }}</span>
            </div>
          } @empty { <p class="muted">Sin ventas en el rango.</p> }
        </div>
      </div>
      <div class="card">
        <h3>Por hora de cobro</h3>
        <div class="chart">
          @for (b of s.byHour; track b.key) {
            <div class="colbar"><span class="v">{{ short(b.total) }}</span><i [style.height.%]="(b.total / maxHour()) * 100"></i><span class="k">{{ b.key }}h</span></div>
          }
        </div>
      </div>
      <div class="card">
        <h3>Productos más vendidos</h3>
        <table class="table"><tbody>
          @for (p of s.topProducts; track p.productId) {
            <tr><td>{{ p.name }}</td><td class="right muted">{{ p.quantity }}</td><td class="right strong num">{{ p.revenue | money }}</td></tr>
          }
        </tbody></table>
      </div>
      <div class="col gap-lg">
        <div class="card">
          <h3>Medios de pago</h3>
          @for (b of s.byPayment; track b.key) {
            <div class="row between line"><span>{{ pay(b.key) }} <span class="faint small">({{ b.count }})</span></span><span class="strong num">{{ b.total | money }}</span></div>
          }
        </div>
        <div class="card">
          <h3>Por mesero (rondas atendidas)</h3>
          @for (b of s.byWaiter; track b.key) {
            <div class="row between line"><span>{{ b.key }} <span class="faint small">({{ b.count }} rondas)</span></span><span class="strong num">{{ b.total | money }}</span></div>
          } @empty { <p class="muted small">Sin datos.</p> }
        </div>
      </div>
    </section>

    <h2 class="mt">Cuentas cobradas</h2>
    <div class="table-wrap mt-s">
      <table class="table">
        <thead><tr><th>Cierre</th><th>Mesa</th><th>Cliente</th><th>Pago</th><th>Cobró</th><th class="right">Total</th><th></th></tr></thead>
        <tbody>
          @for (t of tabs(); track t.id) {
            <tr>
              <td class="muted nowrap">{{ t.closedAt | date: 'd MMM, h:mm a' }}</td>
              <td class="strong">{{ t.tableName }}</td>
              <td class="muted">{{ t.customerName }}</td>
              <td>{{ pay(t.paymentMethod ?? 'OTHER') }}</td>
              <td class="muted">{{ t.closedByName }}</td>
              <td class="right strong num">{{ t.total | money }}</td>
              <td class="right"><button class="btn xs" (click)="open.set(t)">Ver</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="muted">Sin cuentas en el rango.</td></tr> }
        </tbody>
      </table>
    </div>
  }

  @if (open(); as t) {
    <div class="backdrop" (click)="open.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ t.tableName }} · #{{ t.id }}</h2><button class="btn icon sm" (click)="open.set(null)">✕</button></div>
        @for (r of t.rounds; track r.id) {
          @if (r.status === 'CONFIRMED' || r.status === 'DELIVERED') {
            @for (i of r.items; track i.id) {
              <div class="row between line" [class.faint]="i.voided"><span>{{ i.quantity }} × {{ i.productName }} @if (i.voided) { (anulado) }</span><span class="num">{{ i.lineTotal | money }}</span></div>
            }
          }
        }
        <div class="divider"></div>
        <div class="row between line"><span>Consumo</span><span class="num">{{ t.subtotal | money }}</span></div>
        <div class="row between line"><span>Descuento</span><span class="num">−{{ t.discount | money }}</span></div>
        <div class="row between line"><span>Propina</span><span class="num">{{ t.tip | money }}</span></div>
        <div class="row between line strong"><span>Total</span><span class="num">{{ t.total | money }}</span></div>
      </div>
    </div>
  }`,
  styles: [`
    .quick { margin: -6px 0 18px; gap: 8px; }
    .mt { margin-top: 18px; } .mt-s { margin-top: 10px; }
    .chart { display: flex; align-items: flex-end; gap: 6px; height: 190px; padding-top: 18px; overflow-x: auto; }
    .colbar { flex: 1; min-width: 26px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
    .colbar i { width: 100%; max-width: 38px; background: var(--grad); border-radius: 6px 6px 2px 2px; min-height: 3px; }
    .colbar .v { font-size: 10px; color: var(--muted); }
    .colbar .k { font-size: 11px; color: var(--faint); }
    .line { padding: 6px 0; font-size: 14px; }
    .table td { padding: 8px 4px; }
  `],
})
export class SalesComponent implements OnInit {
  private api = inject(Api);
  s = signal<Summary | null>(null);
  tabs = signal<TabView[]>([]);
  open = signal<TabView | null>(null);
  from = '';
  to = '';
  maxDay = computed(() => Math.max(1, ...(this.s()?.byDay ?? []).map(b => b.total)));
  maxHour = computed(() => Math.max(1, ...(this.s()?.byHour ?? []).map(b => b.total)));

  ngOnInit(): void {
    this.range(6);
  }

  range(daysBack: number): void {
    const end = barDay(new Date());
    const start = new Date(end);
    start.setDate(start.getDate() - daysBack);
    if (daysBack === 1) end.setDate(end.getDate() - 1);
    this.from = iso(start);
    this.to = iso(end);
    this.load();
  }

  load(): void {
    this.api.get<Summary>('/admin/reports/summary', { from: this.from, to: this.to }).subscribe(s => this.s.set(s));
    const start = new Date(this.from + 'T06:00:00');
    const end = new Date(this.to + 'T06:00:00');
    end.setDate(end.getDate() + 1);
    this.api.get<TabView[]>('/admin/tabs', { from: start.toISOString(), to: end.toISOString() }).subscribe(t => this.tabs.set(t));
  }

  pay(k: string): string {
    return PAYMENT_LABELS[k as PaymentMethod] ?? k;
  }

  short(v: number): string {
    return v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'k' : String(v);
  }
}

/** Antes de las 6 a. m. todavía es "la noche de ayer". */
function barDay(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() < 6) x.setDate(x.getDate() - 1);
  return x;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
