import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api } from '../../core/api.service';
import { Dashboard, PAYMENT_LABELS, PaymentMethod, Product } from '../../core/models';
import { MoneyPipe } from '../../core/ui';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'bx-dashboard',
  standalone: true,
  imports: [IconComponent, RouterLink, MoneyPipe],
  template: `
  <div class="page-head">
    <div><h1>{{ greeting() }}</h1><p>Así va la noche. Se actualiza solo.</p></div>
    <a class="btn primary" routerLink="../mesero"><bx-icon name="martini" /> Atender mesas</a>
  </div>

  @if (data(); as d) {
    @if (!d.live.cashOpen) {
      <a class="card warn-box" routerLink="caja"><bx-icon name="banknote" /> <b>La caja está cerrada.</b> Ábrela con la base del día para poder cobrar.</a>
    }
    <!-- Ahora: una lista de lo que pide atención, no tarjetas de métricas -->
    <section class="card now">
      <h3>Ahora</h3>
      <a class="now-row" routerLink="../mesero">
        <bx-icon name="layout-grid" /><span class="grow">Mesas abiertas</span>
        <span class="num strong">{{ d.live.openTabs }}</span><span class="num muted">{{ d.live.openDue | money }} por cobrar</span><bx-icon class="go" name="chevron-right" />
      </a>
      <a class="now-row" [class.attn]="d.live.pendingOrders || d.live.openCalls" routerLink="../mesero">
        <bx-icon name="bell-ring" /><span class="grow">Pedidos por asignar · llamados</span>
        <span class="num strong">{{ d.live.pendingOrders }} · {{ d.live.openCalls }}</span><span class="num muted">{{ d.live.inProgress }} rondas en camino</span><bx-icon class="go" name="chevron-right" />
      </a>
      <a class="now-row" routerLink="caja">
        <bx-icon name="banknote" /><span class="grow">Efectivo esperado en caja</span>
        <span class="num strong">{{ d.live.cashOpen ? (d.live.expectedCash | money) : 'Cerrada' }}</span>
        <span class="num muted">@if (d.live.unsettledCount) { <b class="amber">{{ d.live.unsettledTotal | money }} con meseros</b> } @else { al día }</span><bx-icon class="go" name="chevron-right" />
      </a>
      <a class="now-row" [class.warn]="d.live.lowStock" routerLink="inventario">
        <bx-icon name="package" /><span class="grow">Productos por reponer</span>
        <span class="num strong">{{ d.live.lowStock }}</span><span class="num muted">inventario bajo</span><bx-icon class="go" name="chevron-right" />
      </a>
    </section>

    <section class="card today">
      <div class="row between"><h3>Hoy</h3><span class="tiny muted">desde las 6:00 a. m.</span></div>
      <div class="kpis">
        <div><span class="k">Ventas cobradas</span><span class="v num">{{ d.today.totals.sales | money }}</span><span class="h">{{ d.today.totals.tabs }} cuentas · {{ d.today.totals.payments }} cobros</span></div>
        <div><span class="k">Ganancia</span><span class="v num">{{ d.today.totals.profit | money }}</span><span class="h">margen {{ d.today.totals.marginPct }} %</span></div>
        <div><span class="k">Ticket promedio</span><span class="v num">{{ d.today.totals.averageTicket | money }}</span></div>
        <div><span class="k">Propinas</span><span class="v num">{{ d.today.totals.tips | money }}</span></div>
      </div>
    </section>

    <section class="grid cols-2 two">
      <div class="card">
        <h3>Lo más vendido hoy</h3>
        @for (p of d.today.products.slice(0, 8); track p.productId) {
          <div class="bar-row">
            <span class="ellipsis grow">{{ p.quantity }} × {{ p.name }}</span>
            <span class="num strong">{{ p.revenue | money }}</span>
            <div class="bar"><i [style.width.%]="(p.revenue / maxTop()) * 100"></i></div>
          </div>
        } @empty { <p class="muted">Aún no hay ventas cobradas hoy.</p> }
      </div>
      <div class="card">
        <h3>Medios de pago</h3>
        @for (b of d.today.byPayment; track b.key) {
          <div class="row between pay"><span>{{ payLabel(b.key) }} <span class="faint small">({{ b.count }})</span></span><span class="num strong">{{ b.total | money }}</span></div>
        } @empty { <p class="muted">Sin cobros todavía.</p> }
        @if (low().length) {
          <div class="divider"></div>
          <h3>Por reponer</h3>
          @for (p of low(); track p.id) {
            <div class="row between pay"><span>{{ p.name }}</span><span class="badge" [class.red]="p.stock <= 0" [class.amber]="p.stock > 0">{{ p.stock }} {{ p.unit }}</span></div>
          }
        }
      </div>
    </section>
  } @else {
    <div class="col"><div class="skeleton" style="height: 230px"></div><div class="skeleton" style="height: 120px"></div></div>
  }`,
  styles: [`
    .amber { color: var(--c-amber); }
    .warn-box { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; border-color: rgba(255,178,56,.5); color: var(--text); }
    .now { padding: 6px 0 4px; }
    .now h3, .today h3 { padding: 12px 18px 6px; }
    .now-row { display: grid; grid-template-columns: auto 1fr auto minmax(150px, auto) auto; align-items: center; gap: 14px; padding: 13px 18px; color: var(--text); border-top: 1px solid var(--line); transition: background-color 150ms ease; }
    @media (hover: hover) and (pointer: fine) { .now-row:hover { background: var(--hover); } }
    .now-row > bx-icon:first-child { color: var(--muted); --icon-size: 19px; }
    .now-row.attn > bx-icon:first-child { color: var(--c-pink); }
    .now-row.attn .strong { color: var(--c-pink); }
    .now-row.warn .strong { color: var(--c-amber); }
    .now-row .muted { font-size: 13px; text-align: right; }
    .now-row .go { color: var(--faint); }
    .today { margin-top: 14px; padding: 6px 0 0; }
    .today .row { padding-right: 18px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); margin-top: 6px; }
    .kpis > div { display: flex; flex-direction: column; gap: 3px; padding: 14px 18px 16px; }
    .kpis > div + div { border-left: 1px solid var(--line); }
    .k { color: var(--muted); font-size: 13px; font-weight: 650; }
    .v { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
    .h { color: var(--faint); font-size: 12.5px; }
    @media (max-width: 760px) {
      .now-row { grid-template-columns: auto 1fr auto auto; }
      .now-row .muted { display: none; }
      .kpis { grid-template-columns: 1fr 1fr; }
      .kpis > div:nth-child(3) { border-left: 0; }
      .kpis > div:nth-child(n+3) { border-top: 1px solid var(--line); }
    }
    .two { margin-top: 14px; }
    .bar-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 7px 0; font-size: 14px; }
    .bar { grid-column: 1 / -1; height: 6px; border-radius: 9px; background: var(--surface-2); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--amber); border-radius: 9px; }
    .pay { padding: 7px 0; font-size: 14px; }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(Api);
  private destroyRef = inject(DestroyRef);
  data = signal<Dashboard | null>(null);
  low = signal<Product[]>([]);
  maxTop = computed(() => Math.max(1, ...(this.data()?.today.products ?? []).map(p => p.revenue)));

  greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  payLabel(k: string): string {
    return PAYMENT_LABELS[k as PaymentMethod] ?? k;
  }

  ngOnInit(): void {
    timer(0, 15000).pipe(
      switchMap(() => this.api.get<Dashboard>('/admin/dashboard').pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(d => d && this.data.set(d));
    this.api.get<Product[]>('/admin/reports/low-stock').subscribe(l => this.low.set(l.slice(0, 8)));
  }
}
