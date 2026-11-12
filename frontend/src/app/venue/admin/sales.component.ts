import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api.service';
import { PAYMENT_LABELS, PaymentMethod, Summary } from '../../core/models';
import { MoneyPipe } from '../../core/ui';

/** Ventas, costo y ganancia por rango de días. El día contable va de 6:00 a. m. a 6:00 a. m. */
@Component({
  selector: 'bx-sales',
  standalone: true,
  imports: [FormsModule, MoneyPipe],
  template: `
  <div class="page-head">
    <div><h1>Ventas y ganancias</h1><p>Basado en lo cobrado. La ganancia usa el costo de cada producto al momento de la venta.</p></div>
    <div class="row wrap">
      <input class="input" type="date" [(ngModel)]="from" style="width: 160px">
      <input class="input" type="date" [(ngModel)]="to" style="width: 160px">
      <button class="btn primary" (click)="load()">Ver</button>
    </div>
  </div>
  <div class="row wrap quick">
    <button class="chip" (click)="range(0)">Hoy</button><button class="chip" (click)="range(1)">Ayer</button>
    <button class="chip" (click)="range(6)">7 días</button><button class="chip" (click)="range(29)">30 días</button>
  </div>

  @if (s(); as s) {
    <section class="grid cols-4">
      <div class="card stat glow"><span class="label">Ventas</span><span class="value grad-text">{{ s.totals.sales | money }}</span><span class="hint">{{ s.totals.tabs }} cuentas · {{ s.totals.itemsSold }} productos</span></div>
      <div class="card stat"><span class="label">Costo de lo vendido</span><span class="value">{{ s.totals.cost | money }}</span></div>
      <div class="card stat"><span class="label">Ganancia</span><span class="value" style="color: var(--c-green)">{{ s.totals.profit | money }}</span><span class="hint">margen {{ s.totals.marginPct }} %</span></div>
      <div class="card stat"><span class="label">Ticket promedio</span><span class="value">{{ s.totals.averageTicket | money }}</span><span class="hint">propinas {{ s.totals.tips | money }} · desc. {{ s.totals.discounts | money }}</span></div>
    </section>

    <section class="grid cols-2 mt">
      <div class="card"><h3>Por día</h3>
        <div class="chart">
          @for (b of s.byDay; track b.key) {
            <div class="colbar" [title]="b.key + ': ' + (b.total | money)"><span class="v">{{ short(b.total) }}</span><i [style.height.%]="(b.total / maxDay()) * 100"></i><span class="k">{{ b.key.slice(5) }}</span></div>
          } @empty { <p class="muted">Sin ventas en el rango.</p> }
        </div>
      </div>
      <div class="card"><h3>Por hora de cobro</h3>
        <div class="chart">@for (b of s.byHour; track b.key) { <div class="colbar"><span class="v">{{ short(b.total) }}</span><i [style.height.%]="(b.total / maxHour()) * 100"></i><span class="k">{{ b.key }}h</span></div> }</div>
      </div>
    </section>

    <section class="grid cols-2 mt">
      <div class="card"><h3>Medios de pago</h3>
        @for (b of s.byPayment; track b.key) { <div class="row between line"><span>{{ pay(b.key) }} <span class="faint small">({{ b.count }})</span></span><span class="strong num">{{ b.total | money }}</span></div> }
      </div>
      <div class="card"><h3>Cobrado por</h3>
        @for (b of s.byWaiter; track b.key) { <div class="row between line"><span>{{ b.key }} <span class="faint small">({{ b.count }} cobros)</span></span><span class="strong num">{{ b.total | money }}</span></div> } @empty { <p class="muted small">Sin datos.</p> }
      </div>
    </section>

    <h2 class="mt">Ganancia por producto</h2>
    <div class="table-wrap mt-s">
      <table class="table">
        <thead><tr><th>Producto</th><th class="right">Cantidad</th><th class="right">Venta</th><th class="right">Costo</th><th class="right">Ganancia</th><th class="right">Margen</th></tr></thead>
        <tbody>
          @for (p of s.products; track p.productId) {
            <tr><td class="strong">{{ p.name }}</td><td class="right">{{ p.quantity }}</td><td class="right num">{{ p.revenue | money }}</td>
              <td class="right num muted">{{ p.cost ? (p.cost | money) : 'sin costo' }}</td><td class="right num strong" style="color: var(--c-green)">{{ p.profit | money }}</td>
              <td class="right muted">{{ p.revenue ? ((p.profit / p.revenue) * 100).toFixed(0) + ' %' : '' }}</td></tr>
          } @empty { <tr><td colspan="6" class="muted">Sin ventas en el rango.</td></tr> }
        </tbody>
      </table>
    </div>
  }`,
  styles: [`
    .quick { margin: -6px 0 18px; gap: 8px; }
    .mt { margin-top: 18px; } .mt-s { margin-top: 10px; }
    .chart { display: flex; align-items: flex-end; gap: 6px; height: 190px; padding-top: 18px; overflow-x: auto; }
    .colbar { flex: 1; min-width: 26px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
    .colbar i { width: 100%; max-width: 38px; background: var(--grad); border-radius: 6px 6px 2px 2px; min-height: 3px; }
    .colbar .v { font-size: 10px; color: var(--muted); } .colbar .k { font-size: 11px; color: var(--faint); }
    .line { padding: 6px 0; font-size: 14px; }
  `],
})
export class SalesComponent implements OnInit {
  private api = inject(Api);
  s = signal<Summary | null>(null);
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
  }

  pay(k: string): string {
    return PAYMENT_LABELS[k as PaymentMethod] ?? k;
  }

  short(v: number): string {
    return v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'k' : String(v);
  }
}

function barDay(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() < 6) x.setDate(x.getDate() - 1);
  return x;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
