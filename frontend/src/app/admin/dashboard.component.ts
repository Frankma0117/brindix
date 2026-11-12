import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api } from '../core/api.service';
import { Dashboard, PAYMENT_LABELS, PaymentMethod, Product } from '../core/models';
import { MoneyPipe } from '../core/ui';
import { MascotComponent } from '../shared/mascot.component';

@Component({
  selector: 'bx-dashboard',
  standalone: true,
  imports: [RouterLink, MoneyPipe, MascotComponent],
  template: `
  <div class="page-head">
    <div class="row">
      <bx-mascot [size]="58" mood="wink" />
      <div><h1>{{ greeting() }}</h1><p>Así va la noche. Se actualiza solo.</p></div>
    </div>
    <a class="btn primary" routerLink="/mesero">🍸 Atender mesas</a>
  </div>

  @if (data(); as d) {
    <section class="grid cols-4">
      <a class="card stat live" routerLink="/mesero">
        <span class="label">Mesas abiertas</span><span class="value">{{ d.live.openTabs }}</span>
        <span class="hint">{{ d.live.openAmount | money }} por cobrar</span>
      </a>
      <a class="card stat" [class.attn]="d.live.pendingOrders || d.live.openCalls" routerLink="/mesero">
        <span class="label">Pedidos / llamados</span><span class="value">{{ d.live.pendingOrders }} · {{ d.live.openCalls }}</span>
        <span class="hint">Esperando a un mesero</span>
      </a>
      <a class="card stat" routerLink="/admin/musica">
        <span class="label">Música</span><span class="value">{{ d.live.songsQueued }}</span>
        <span class="hint">en cola @if (d.live.songsPending) { · <b class="pink">{{ d.live.songsPending }} por aprobar</b> }</span>
      </a>
      <a class="card stat" [class.warn]="d.live.lowStock" routerLink="/admin/inventario">
        <span class="label">Inventario bajo</span><span class="value">{{ d.live.lowStock }}</span>
        <span class="hint">productos por reponer</span>
      </a>
    </section>

    <h2 class="sec">Hoy (desde las 6:00 a. m.)</h2>
    <section class="grid cols-4">
      <div class="card stat glow"><span class="label">Ventas cobradas</span><span class="value grad-text">{{ d.today.totals.sales | money }}</span><span class="hint">{{ d.today.totals.tabs }} cuentas</span></div>
      <div class="card stat"><span class="label">Ticket promedio</span><span class="value">{{ d.today.totals.averageTicket | money }}</span></div>
      <div class="card stat"><span class="label">Propinas</span><span class="value">{{ d.today.totals.tips | money }}</span></div>
      <div class="card stat"><span class="label">Productos vendidos</span><span class="value">{{ d.today.totals.itemsSold }}</span><span class="hint">Margen aprox. {{ d.today.totals.estimatedMargin | money }}</span></div>
    </section>

    <section class="grid cols-2 two">
      <div class="card">
        <h3>Lo más vendido hoy</h3>
        @for (p of d.today.topProducts.slice(0, 8); track p.productId) {
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
    <div class="grid cols-4">@for (i of [1,2,3,4]; track i) { <div class="skeleton" style="height: 110px"></div> }</div>
  }`,
  styles: [`
    .stat { color: var(--text); }
    a.stat:hover { border-color: var(--line-2); }
    .stat.attn { border-color: rgba(255,79,139,.55); }
    .stat.warn { border-color: rgba(255,178,56,.45); }
    .pink { color: #ff8fb5; }
    .sec { margin: 28px 0 12px; font-size: 18px; }
    .two { margin-top: 14px; }
    .bar-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 7px 0; font-size: 14px; }
    .bar { grid-column: 1 / -1; height: 6px; border-radius: 9px; background: var(--surface-2); overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--grad); border-radius: 9px; }
    .pay { padding: 7px 0; font-size: 14px; }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(Api);
  private destroyRef = inject(DestroyRef);
  data = signal<Dashboard | null>(null);
  low = signal<Product[]>([]);
  maxTop = computed(() => Math.max(1, ...(this.data()?.today.topProducts ?? []).map(p => p.revenue)));

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
