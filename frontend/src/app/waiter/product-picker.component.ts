import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Product } from '../core/models';
import { MoneyPipe } from '../core/ui';
import { ProductArtComponent } from '../shared/product-art.component';

export interface PickedLine { product: Product; quantity: number; note?: string; }

/**
 * Selector rápido para cargar una ronda: tocar un producto suma la cantidad elegida
 * (×1, ×2, ×6…), así una tanda de 6 cervezas son dos toques.
 */
@Component({
  selector: 'bx-product-picker',
  standalone: true,
  imports: [FormsModule, MoneyPipe, ProductArtComponent],
  template: `
  <div class="picker">
    <div class="top">
      <div class="row between">
        <h2>Nueva ronda</h2>
        <button class="btn icon sm" (click)="cancel.emit()" aria-label="Cerrar">✕</button>
      </div>
      <label class="search"><input class="input" placeholder="Buscar producto" [ngModel]="q()" (ngModelChange)="q.set($event)"></label>
      <div class="row scroll">
        <button class="chip" [class.active]="cat() === null" (click)="cat.set(null)">Todo</button>
        @for (c of categories(); track c.id) {
          <button class="chip" [class.active]="cat() === c.id" (click)="cat.set(c.id)">{{ c.icon }} {{ c.name }}</button>
        }
      </div>
      <div class="row mult">
        <span class="small muted">Cada toque suma</span>
        @for (m of multipliers; track m) {
          <button class="chip" [class.active]="mult() === m" (click)="mult.set(m)">×{{ m }}</button>
        }
      </div>
    </div>

    <div class="tiles">
      @for (p of visible(); track p.id) {
        <button class="tile" [class.sel]="qty(p.id)" [class.off]="!p.available" (click)="add(p)">
          <bx-art class="ti-img" [art]="p.art" [imageUrl]="p.imageUrl" [name]="p.name" />
          <span class="ti-name">{{ p.name }}</span>
          <span class="ti-price num">{{ p.price | money }}</span>
          @if (p.trackStock) { <span class="ti-stock" [class.low]="p.lowStock">{{ p.stock }} {{ p.unit }}</span> }
          @if (qty(p.id)) { <span class="ti-qty">{{ qty(p.id) }}</span> }
        </button>
      } @empty { <p class="muted pad">Sin resultados</p> }
    </div>

    @if (lines().length) {
      <div class="basket">
        <div class="lines">
          @for (l of lines(); track l.product.id) {
            <div class="line">
              <div class="grow">
                <p class="strong ellipsis">{{ l.product.name }}</p>
                <input class="note" placeholder="Nota (sin hielo…)" [ngModel]="l.note" (ngModelChange)="setNote(l, $event)" maxlength="120">
              </div>
              <div class="stepper">
                <button (click)="change(l, -1)">−</button><span>{{ l.quantity }}</span><button (click)="change(l, 1)">+</button>
              </div>
            </div>
          }
        </div>
        <button class="btn primary lg block" [disabled]="busy()" (click)="submit.emit(lines())">
          Cargar ronda · {{ count() }} prod. · {{ total() | money }}
        </button>
      </div>
    }
  </div>`,
  styles: [`
    .picker { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; animation: up .2s ease; }
    .top { padding: 14px 16px 10px; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--line); max-width: 1180px; width: 100%; margin: 0 auto; }
    .scroll { overflow-x: auto; scrollbar-width: none; }
    .mult { gap: 6px; overflow-x: auto; }
    .mult .chip { height: 30px; padding: 0 12px; }
    .tiles { flex: 1; overflow-y: auto; padding: 12px 16px 20px; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); align-content: start; max-width: 1180px; width: 100%; margin: 0 auto; }
    .tile { position: relative; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--text); padding: 0 0 10px; display: flex; flex-direction: column; text-align: left; overflow: hidden; cursor: pointer; font: inherit; }
    .tile:active { transform: scale(.96); }
    .tile.sel { border-color: var(--pink); box-shadow: 0 0 0 2px rgba(255,79,139,.35); }
    .tile.off { opacity: .45; }
    .ti-img { height: 84px; margin-bottom: 8px; }
    .ti-name { padding: 0 10px; font-weight: 700; font-size: 13.5px; line-height: 1.2; }
    .ti-price { padding: 2px 10px 0; color: var(--amber); font-weight: 800; font-size: 13px; }
    .ti-stock { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.6); border-radius: 99px; padding: 1px 8px; font-size: 11px; font-weight: 700; }
    .ti-stock.low { background: rgba(255,93,93,.85); }
    .ti-qty { position: absolute; top: 6px; right: 6px; min-width: 30px; height: 30px; border-radius: 99px; background: var(--grad); color: #1a0b12; font-weight: 800; display: grid; place-items: center; }
    .basket { border-top: 1px solid var(--line-2); background: var(--surface); padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); max-height: 46vh; display: flex; flex-direction: column; gap: 10px; }
    .lines { overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .line { display: flex; gap: 10px; align-items: center; }
    .note { width: 100%; background: transparent; border: 0; border-bottom: 1px dashed var(--line-2); color: var(--muted); font: 500 12.5px var(--font); padding: 3px 0; outline: none; }
    .pad { padding: 20px; }
  `],
})
export class ProductPickerComponent {
  products = input.required<Product[]>();
  categories = input.required<Category[]>();
  busy = input(false);
  submit = output<PickedLine[]>();
  cancel = output<void>();

  multipliers = [1, 2, 3, 6, 12];
  q = signal('');
  cat = signal<number | null>(null);
  mult = signal(1);
  lines = signal<PickedLine[]>([]);

  visible = computed(() => {
    const q = this.q().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return this.products().filter(p =>
      (this.cat() === null || p.categoryId === this.cat()) &&
      (!q || p.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(q)));
  });
  count = computed(() => this.lines().reduce((a, l) => a + l.quantity, 0));
  total = computed(() => this.lines().reduce((a, l) => a + l.quantity * l.product.price, 0));

  qty(id: number): number {
    return this.lines().find(l => l.product.id === id)?.quantity ?? 0;
  }

  add(p: Product): void {
    const m = this.mult();
    this.lines.update(ls => ls.some(l => l.product.id === p.id)
      ? ls.map(l => l.product.id === p.id ? { ...l, quantity: Math.min(99, l.quantity + m) } : l)
      : [...ls, { product: p, quantity: m }]);
    try { navigator.vibrate?.(15); } catch { /* */ }
  }

  change(line: PickedLine, d: number): void {
    this.lines.update(ls => ls.map(l => l === line ? { ...l, quantity: Math.min(99, l.quantity + d) } : l).filter(l => l.quantity > 0));
  }

  setNote(line: PickedLine, note: string): void {
    this.lines.update(ls => ls.map(l => l === line ? { ...l, note } : l));
  }
}
