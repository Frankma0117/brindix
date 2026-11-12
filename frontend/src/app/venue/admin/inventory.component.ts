import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { MOVEMENT_LABELS, Movement, MovementType, PAYMENT_LABELS, PaymentMethod, Product, StockSummary } from '../../core/models';
import { MoneyPipe, Toasts } from '../../core/ui';

interface EntryLine { productId: number | null; quantity: number | null; unitCost: number | null; }

/** Existencias, entradas de mercancía por factura, mermas, conteos y kardex. Solo administrador. */
@Component({
  selector: 'bx-inventory',
  standalone: true,
  imports: [FormsModule, MoneyPipe, DatePipe],
  template: `
  <div class="page-head">
    <div><h1>Inventario</h1><p>Lo que entra, lo que se vende y lo que se pierde. El costo se promedia solo con cada entrada.</p></div>
    <div class="row"><button class="btn" (click)="openAdjust()">Merma / conteo</button><button class="btn primary" (click)="openEntry()">＋ Entrada de mercancía</button></div>
  </div>

  @if (summary(); as s) {
    <section class="grid cols-4">
      <div class="card stat"><span class="label">Con inventario</span><span class="value">{{ s.products }}</span></div>
      <div class="card stat"><span class="label">Bajos · agotados</span><span class="value"><span style="color: var(--c-amber)">{{ s.lowStock }}</span> · <span style="color: var(--c-red)">{{ s.soldOut }}</span></span></div>
      <div class="card stat"><span class="label">Valor a costo</span><span class="value">{{ s.inventoryValue | money }}</span><span class="hint">lo que pagaste</span></div>
      <div class="card stat"><span class="label">Valor a precio de venta</span><span class="value">{{ s.saleValue | money }}</span><span class="hint">ganancia potencial {{ s.saleValue - s.inventoryValue | money }}</span></div>
    </section>
  }

  <div class="row tabs">
    <button class="chip" [class.active]="tabView() === 'stock'" (click)="tabView.set('stock')">Existencias</button>
    <button class="chip" [class.active]="tabView() === 'moves'" (click)="tabView.set('moves'); loadMoves()">Movimientos (kardex)</button>
  </div>

  @if (tabView() === 'stock') {
    <div class="row wrap filters">
      <label class="search grow"><input class="input" placeholder="Buscar producto" [ngModel]="q()" (ngModelChange)="q.set($event)"></label>
      <label class="check"><input type="checkbox" [ngModel]="onlyLow()" (ngModelChange)="onlyLow.set($event)"> Solo por reponer</label>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Producto</th><th>Categoría</th><th class="right">Existencia</th><th class="right">Mínimo</th><th class="right">Costo prom.</th><th class="right">Venta</th><th class="right">Valor</th><th></th></tr></thead>
        <tbody>
          @for (p of visibleStock(); track p.id) {
            <tr>
              <td class="strong">{{ p.name }}</td>
              <td class="muted">{{ p.categoryName }}</td>
              <td class="right"><span class="badge" [class.red]="p.stock <= 0" [class.amber]="p.lowStock && p.stock > 0" [class.green]="!p.lowStock">{{ p.stock }} {{ p.unit }}</span></td>
              <td class="right muted">{{ p.minStock }}</td>
              <td class="right num">{{ p.cost ? (p.cost | money) : '—' }}</td>
              <td class="right num">{{ p.price | money }}</td>
              <td class="right num muted">{{ p.cost && p.stock > 0 ? (p.cost * p.stock | money) : '—' }}</td>
              <td class="right"><button class="btn xs" (click)="history(p)">Kardex</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  } @else {
    <div class="row wrap filters">
      <select class="input" style="max-width: 260px" [ngModel]="moveProduct()" (ngModelChange)="moveProduct.set($event); loadMoves()">
        <option [ngValue]="null">Todos los productos</option>
        @for (p of tracked(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
      </select>
      <select class="input" style="max-width: 200px" [ngModel]="moveType()" (ngModelChange)="moveType.set($event); loadMoves()">
        <option [ngValue]="null">Todos los tipos</option>
        @for (t of types; track t[0]) { <option [ngValue]="t[0]">{{ t[1] }}</option> }
      </select>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="right">Cant.</th><th class="right">Queda</th><th>Detalle</th><th>Quién</th></tr></thead>
        <tbody>
          @for (m of moves(); track m.id) {
            <tr>
              <td class="nowrap muted">{{ m.createdAt | date: 'd MMM, h:mm a' }}</td>
              <td class="strong">{{ m.productName }}</td>
              <td><span class="badge" [class.green]="m.type === 'ENTRY'" [class.pink]="m.type === 'SALE'" [class.red]="m.type === 'WASTE'" [class.teal]="m.type === 'RETURN'">{{ labels[m.type] }}</span></td>
              <td class="right num strong" [style.color]="m.quantity > 0 ? 'var(--green)' : 'var(--text)'">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</td>
              <td class="right num">{{ m.stockAfter }}</td>
              <td class="small muted">{{ detail(m) }}@if (m.unitCost && m.type === 'ENTRY') { · {{ m.unitCost | money }} c/u }</td>
              <td class="small muted">{{ m.userName }}</td>
            </tr>
          } @empty { <tr><td colspan="7" class="muted">Sin movimientos.</td></tr> }
        </tbody>
      </table>
    </div>
  }

  @if (entryOpen()) {
    <div class="backdrop" (click)="entryOpen.set(false)">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>Entrada de mercancía</h2><button class="btn icon sm" (click)="entryOpen.set(false)">✕</button></div>
        <div class="form-grid">
          <label class="field"><span>Proveedor</span><input class="input" [(ngModel)]="supplier" placeholder="Ej: Bavaria"></label>
          <label class="field"><span>Factura / referencia</span><input class="input" [(ngModel)]="reference"></label>
        </div>
        <div class="lines">
          <div class="lrow head tiny muted"><span>Producto</span><span>Cantidad</span><span>Costo unitario</span><span></span></div>
          @for (l of lines(); track $index; let i = $index) {
            <div class="lrow">
              <select class="input" [(ngModel)]="l.productId" (ngModelChange)="prefillCost(l)">
                <option [ngValue]="null">Elegir…</option>
                @for (p of tracked(); track p.id) { <option [ngValue]="p.id">{{ p.name }} (hay {{ p.stock }})</option> }
              </select>
              <input class="input" type="number" min="1" [(ngModel)]="l.quantity" placeholder="0">
              <input class="input" type="number" min="0" step="100" [(ngModel)]="l.unitCost" placeholder="A cómo lo compraste">
              <button class="btn icon sm ghost" (click)="removeLine(i)">✕</button>
            </div>
          }
          <button class="btn sm" (click)="addLine()">＋ Otro producto</button>
        </div>
        <label class="field"><span>Nota</span><input class="input" [(ngModel)]="note"></label>
        <div class="card flat col paid">
          <label class="check"><input type="checkbox" [(ngModel)]="paidFromCash"> Se pagó con dinero de la caja (se registra como salida en el turno abierto)</label>
          @if (paidFromCash) {
            <div class="row wrap">@for (m of methods; track m[0]) { <button class="chip" [class.active]="payMethod === m[0]" (click)="payMethod = m[0]">{{ m[1] }}</button> }</div>
          }
        </div>
        <div class="row between total"><span class="muted">Total de la factura</span><span class="strong num">{{ entryTotal() | money }}</span></div>
        <div class="modal-foot">
          <button class="btn" (click)="entryOpen.set(false)">Cancelar</button>
          <button class="btn primary" [disabled]="busy() || !validLines().length" (click)="saveEntry()">Registrar {{ validLines().length }} producto(s)</button>
        </div>
      </div>
    </div>
  }

  @if (adjustOpen()) {
    <div class="backdrop" (click)="adjustOpen.set(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>Ajuste de inventario</h2><button class="btn icon sm" (click)="adjustOpen.set(false)">✕</button></div>
        <div class="col">
          <div class="row wrap">
            <button class="chip" [class.active]="adjType === 'WASTE'" (click)="adjType = 'WASTE'">Merma (roto, vencido, cortesía)</button>
            <button class="chip" [class.active]="adjType === 'ADJUSTMENT'" (click)="adjType = 'ADJUSTMENT'">Conteo físico</button>
          </div>
          <label class="field"><span>Producto</span>
            <select class="input" [(ngModel)]="adjProduct"><option [ngValue]="null">Elegir…</option>@for (p of tracked(); track p.id) { <option [ngValue]="p.id">{{ p.name }} (hay {{ p.stock }})</option> }</select>
          </label>
          <label class="field"><span>{{ adjType === 'WASTE' ? 'Unidades perdidas' : 'Unidades contadas' }}</span><input class="input" type="number" min="0" [(ngModel)]="adjQty"></label>
          <label class="field"><span>Motivo</span><input class="input" [(ngModel)]="adjNote" placeholder="Ej: se cayó una botella"></label>
        </div>
        <div class="modal-foot">
          <button class="btn" (click)="adjustOpen.set(false)">Cancelar</button>
          <button class="btn primary" [disabled]="!adjProduct || adjQty === null" (click)="saveAdjust()">Guardar</button>
        </div>
      </div>
    </div>
  }`,
  styles: [`
    .tabs { margin: 22px 0 14px; }
    .filters { margin-bottom: 12px; gap: 12px; }
    .lines { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
    .lrow { display: grid; grid-template-columns: 2fr 1fr 1fr 42px; gap: 8px; align-items: center; }
    .lrow.head { padding: 0 4px; }
    @media (max-width: 600px) { .lrow { grid-template-columns: 1fr 1fr; } .lrow select { grid-column: 1 / -1; } .lrow.head { display: none; } }
    .paid { margin-top: 12px; }
    .total { margin-top: 14px; font-size: 16px; }
  `],
})
export class InventoryComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);

  products = signal<Product[]>([]);
  summary = signal<StockSummary | null>(null);
  moves = signal<Movement[]>([]);
  tabView = signal<'stock' | 'moves'>('stock');
  q = signal('');
  onlyLow = signal(false);
  moveProduct = signal<number | null>(null);
  moveType = signal<MovementType | null>(null);
  labels = MOVEMENT_LABELS;
  types = Object.entries(MOVEMENT_LABELS) as [MovementType, string][];
  methods = Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][];
  busy = signal(false);

  entryOpen = signal(false);
  supplier = '';
  reference = '';
  note = '';
  paidFromCash = false;
  payMethod: PaymentMethod = 'CASH';
  lines = signal<EntryLine[]>([]);

  adjustOpen = signal(false);
  adjType: MovementType = 'WASTE';
  adjProduct: number | null = null;
  adjQty: number | null = null;
  adjNote = '';

  tracked = computed(() => this.products().filter(p => p.trackStock));
  visibleStock = computed(() => {
    const q = this.q().toLowerCase();
    return this.tracked().filter(p => (!this.onlyLow() || p.lowStock) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.lowStock) - Number(a.lowStock));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Product[]>('/admin/products').subscribe(p => this.products.set(p));
    this.api.get<StockSummary>('/admin/inventory/summary').subscribe(s => this.summary.set(s));
  }

  loadMoves(): void {
    this.api.get<Movement[]>('/admin/inventory/movements', { productId: this.moveProduct(), type: this.moveType(), limit: 400 })
      .subscribe(m => this.moves.set(m));
  }

  detail(m: Movement): string {
    return [m.supplier, m.reference, m.note].filter(x => !!x).join(' · ');
  }

  history(p: Product): void {
    this.moveProduct.set(p.id);
    this.moveType.set(null);
    this.tabView.set('moves');
    this.loadMoves();
  }

  openEntry(): void {
    this.supplier = '';
    this.reference = '';
    this.note = '';
    this.paidFromCash = false;
    this.payMethod = 'CASH';
    this.lines.set([{ productId: null, quantity: null, unitCost: null }]);
    this.entryOpen.set(true);
  }

  addLine(): void {
    this.lines.update(l => [...l, { productId: null, quantity: null, unitCost: null }]);
  }

  removeLine(i: number): void {
    this.lines.update(l => l.filter((_, k) => k !== i));
  }

  prefillCost(l: EntryLine): void {
    const p = this.products().find(x => x.id === l.productId);
    if (p?.cost && !l.unitCost) l.unitCost = p.cost;
  }

  validLines(): EntryLine[] {
    return this.lines().filter(l => l.productId && (l.quantity ?? 0) > 0);
  }

  entryTotal(): number {
    return this.validLines().reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  }

  async saveEntry(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.run(this.api.post('/admin/inventory/entries', {
        supplier: this.supplier, reference: this.reference, note: this.note, paidFromCash: this.paidFromCash, paymentMethod: this.payMethod,
        items: this.validLines().map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: l.unitCost ? Number(l.unitCost) : null })),
      }));
      this.toasts.ok(this.paidFromCash ? 'Entrada registrada y descontada de la caja' : 'Entrada registrada');
      this.entryOpen.set(false);
      this.load();
      if (this.tabView() === 'moves') this.loadMoves();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  openAdjust(): void {
    this.adjType = 'WASTE';
    this.adjProduct = null;
    this.adjQty = null;
    this.adjNote = '';
    this.adjustOpen.set(true);
  }

  async saveAdjust(): Promise<void> {
    try {
      await this.api.run(this.api.post('/admin/inventory/adjustments', {
        productId: this.adjProduct, type: this.adjType, note: this.adjNote,
        countedStock: this.adjType === 'ADJUSTMENT' ? Number(this.adjQty) : null,
        quantity: this.adjType === 'WASTE' ? Number(this.adjQty) : null,
      }));
      this.toasts.ok('Inventario ajustado');
      this.adjustOpen.set(false);
      this.load();
      if (this.tabView() === 'moves') this.loadMoves();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
