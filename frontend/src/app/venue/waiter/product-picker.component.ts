import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuCategory, MenuProduct, WaiterOption } from '../../core/models';
import { Auth } from '../../core/auth.service';
import { MoneyPipe } from '../../core/ui';
import { ProductArtComponent } from '../../shared/product-art.component';
import { IconComponent } from '../../shared/icon.component';
import { Dialogs } from '../../shared/dialogs';

export interface PickedLine { product: MenuProduct; quantity: number; note?: string; }

interface Section { id: number | string; title: string; products: MenuProduct[]; }

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Toma de pedido del mesero, hecha para una mano y para ir rápido:
 * tocar un producto suma 1; en el producto elegido, los botones rápidos ponen la tanda
 * (2, 3, 6, 12…) de un toque; la barra de abajo envía el pedido.
 */
@Component({
  selector: 'bx-product-picker',
  standalone: true,
  imports: [FormsModule, MoneyPipe, ProductArtComponent, IconComponent],
  template: `
  <div class="picker">
    <header class="top">
      <div class="bar">
        <button class="btn icon sm" (click)="cancel.emit()" aria-label="Cerrar"><bx-icon name="x" /></button>
        <div class="grow">
          <h2 class="ellipsis">Pedido · {{ tableName() || 'Mesa' }}</h2>
        </div>
        @if (count()) { <button class="btn ghost sm" (click)="clear()">Vaciar</button> }
      </div>
      <label class="search"><input class="input" placeholder="Buscar producto…" [ngModel]="q()" (ngModelChange)="q.set($event)" autocomplete="off"></label>
      @if (!q()) {
        <div class="cats">
          @if (hasFeatured()) { <button class="chip" [class.active]="cat() === 'top'" (click)="cat.set('top')"><bx-icon name="star" /> Destacados</button> }
          <button class="chip" [class.active]="cat() === null" (click)="cat.set(null)">Todo</button>
          @for (c of menu(); track c.id) { <button class="chip" [class.active]="cat() === c.id" (click)="cat.set(c.id)">{{ c.name }}</button> }
        </div>
      }
    </header>

    <div class="list">
      @for (s of sections(); track s.id) {
        @if (s.title) { <h3 class="sec">{{ s.title }}</h3> }
        @for (p of s.products; track p.id) {
          <div class="prod" [class.on]="qty(p.id)" [class.off]="p.soldOut">
            <button class="main" (click)="add(p)" [disabled]="p.soldOut">
              <bx-art class="thumb" [art]="p.art" [imageUrl]="p.imageUrl" [name]="p.name" />
              <span class="info">
                <span class="name">{{ p.name }}</span>
                <span class="meta">
                  <b class="price num">{{ p.price | money }}</b>
                  @if (p.soldOut) { <span class="badge red">Agotado</span> }
                  @else if (p.trackStock) { <span class="stock" [class.low]="(p.stock ?? 0) <= 3">{{ p.stock }} {{ p.unit }}</span> }
                </span>
              </span>
            </button>
            @if (qty(p.id); as n) {
              <div class="stepper big"><button (click)="dec(p)" aria-label="Quitar uno"><bx-icon name="minus" /></button><span>{{ n }}</span><button (click)="add(p)" aria-label="Sumar uno"><bx-icon name="plus" /></button></div>
              <div class="quick">
                @for (m of batches; track m) { <button class="qchip" [class.active]="n === m" (click)="setQty(p, m)">{{ m }}</button> }
                <button class="qchip" [class.active]="!!noteOf(p.id) || noteOpen() === p.id" (click)="toggleNote(p.id)"><bx-icon name="sticky-note" /> Nota</button>
              </div>
              @if (noteOpen() === p.id || noteOf(p.id)) {
                <input class="input note" placeholder="Ej: sin hielo, bien fría…" maxlength="120" [ngModel]="noteOf(p.id)" (ngModelChange)="setNote(p, $event)">
              }
            } @else {
              <button class="plus" (click)="add(p)" [disabled]="p.soldOut" aria-label="Agregar"><bx-icon name="plus" /></button>
            }
          </div>
        }
      } @empty {
        <div class="empty"><p>No hay productos con «{{ q() }}».</p><button class="btn sm" (click)="q.set('')">Ver todo</button></div>
      }
    </div>

    <footer class="foot" [class.show]="count()">
      @if (reviewing()) {
        <div class="review">
          <div class="row between"><h3>Revisa el pedido</h3><button class="btn ghost sm" (click)="reviewing.set(false)">Seguir agregando</button></div>
          <div class="rlines">
            @for (l of lines(); track l.product.id) {
              <div class="rline">
                <div class="grow"><p class="strong">{{ l.product.name }}</p>@if (l.note) { <p class="tiny muted">«{{ l.note }}»</p> }</div>
                <span class="num small muted">{{ l.quantity * l.product.price | money }}</span>
                <div class="stepper"><button (click)="dec(l.product)">−</button><span>{{ l.quantity }}</span><button (click)="add(l.product)">+</button></div>
              </div>
            }
          </div>
          @if (waiters().length) {
            <select class="input" [ngModel]="assignTo()" (ngModelChange)="assignTo.set($event)">
              <option [ngValue]="null">La lleva: el mesero de la mesa</option>
              @for (w of waiters(); track w.id) { <option [ngValue]="w.id">La lleva: {{ auth.staffLabel(w) }}</option> }
            </select>
          }
        </div>
      }
      <div class="send">
        <button class="sum" (click)="reviewing.set(!reviewing())">
          <span class="count">{{ count() }}</span>
          <span class="col0"><b class="num">{{ total() | money }}</b><span class="tiny muted">{{ reviewing() ? 'Ocultar' : 'Ver pedido' }} ▴</span></span>
        </button>
        <button class="btn primary lg grow" [disabled]="busy() || !count()" (click)="send()">{{ busy() ? 'Enviando…' : 'Enviar pedido' }}</button>
      </div>
    </footer>
  </div>`,
  styles: [`
    .picker { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; animation: up .18s ease; }
    .top { flex: none; background: var(--glass); border-bottom: 1px solid var(--line); padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
    .top > *, .list, .foot > * { width: 100%; max-width: 720px; margin-left: auto; margin-right: auto; }
    .bar { display: flex; align-items: center; gap: 12px; }
    .bar h2 { font-size: 20px; }
    .cats { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
    .cats::-webkit-scrollbar { display: none; }
    .cats .chip { height: 34px; flex: none; }

    .list { flex: 1; overflow-y: auto; padding: 4px 14px 24px; -webkit-overflow-scrolling: touch; }
    .sec { font-size: 14px; font-weight: 800; color: var(--muted); margin: 18px 4px 6px; }
    .prod { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 10px; padding: 6px 8px 6px 6px; border-radius: 16px; border: 1px solid transparent; transition: background .12s, border-color .12s; }
    .prod + .prod { margin-top: 2px; }
    .prod.on { background: var(--surface); border-color: rgba(255, 79, 139, .45); }
    .prod.off { opacity: .45; }
    .main { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 0; border: 0; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
    .main:active .thumb { transform: scale(.94); }
    .thumb { width: 54px; height: 54px; flex: none; border-radius: 14px; transition: transform .1s; }
    .info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .name { font-weight: 700; font-size: 15px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .meta { display: flex; align-items: center; gap: 8px; }
    .price { color: var(--c-amber); font-size: 14px; }
    .stock { font-size: 12px; color: var(--faint); font-weight: 600; }
    .stock.low { color: var(--c-red); }
    .plus { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--text); --icon-size: 22px; cursor: pointer; transition: transform 120ms var(--ease-out); }
    .plus:active { transform: scale(.92); background: var(--surface-3); }
    .stepper.big button { width: 40px; height: 40px; font-size: 22px; }
    .stepper.big span { min-width: 30px; font-size: 17px; }
    .quick { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 0 2px 66px; }
    .qchip { display: inline-flex; align-items: center; gap: 5px; height: 32px; min-width: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--bg-2); color: var(--muted); font: 700 13.5px var(--font); cursor: pointer; }
    .qchip.active { background: var(--text); color: var(--chip-on); border-color: var(--text); }
    .note { grid-column: 1 / -1; margin: 8px 0 2px 66px; width: calc(100% - 66px); height: 40px; font-size: 14px; }
    @media (max-width: 420px) { .quick { padding-left: 0; } .note { margin-left: 0; width: 100%; } }

    .foot { flex: none; border-top: 1px solid var(--line-2); background: var(--surface); box-shadow: var(--shadow-lg); padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); display: none; flex-direction: column; gap: 10px; }
    .foot.show { display: flex; animation: up .15s ease; }
    .review { display: flex; flex-direction: column; gap: 10px; max-height: 46vh; }
    .rlines { overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .rline { display: flex; align-items: center; gap: 10px; }
    .send { display: flex; gap: 10px; align-items: center; }
    .sum { display: flex; align-items: center; gap: 10px; padding: 0 8px 0 0; border: 0; background: none; color: var(--text); font: inherit; cursor: pointer; text-align: left; }
    .count { min-width: 40px; height: 40px; padding: 0 8px; border-radius: 12px; background: var(--grad); color: #1a0b12; font-weight: 800; font-size: 17px; display: grid; place-items: center; }
    .col0 { display: flex; flex-direction: column; }
    .col0 b { font-size: 17px; }
    .empty { padding: 40px 10px; }
  `],
})
export class ProductPickerComponent {
  private dialogs = inject(Dialogs);
  auth = inject(Auth);
  menu = input.required<MenuCategory[]>();
  tableName = input('');
  /** Solo el administrador elige quién lleva la ronda. */
  waiters = input<WaiterOption[]>([]);
  busy = input(false);
  submit = output<{ lines: PickedLine[]; assignedTo: number | null }>();
  cancel = output<void>();

  /** Tandas rápidas: un toque pone la cantidad exacta. */
  batches = [1, 2, 3, 6, 12];
  q = signal('');
  cat = signal<number | 'top' | null>(null);
  assignTo = signal<number | null>(null);
  lines = signal<PickedLine[]>([]);
  reviewing = signal(false);
  noteOpen = signal<number | null>(null);

  hasFeatured = computed(() => this.menu().some(c => c.products.some(p => p.featured)));

  sections = computed<Section[]>(() => {
    const q = norm(this.q().trim());
    if (q) {
      const found = this.menu().flatMap(c => c.products).filter(p => norm(p.name).includes(q));
      return found.length ? [{ id: 'q', title: '', products: found }] : [];
    }
    const cat = this.cat();
    if (cat === 'top') return [{ id: 'top', title: '', products: this.menu().flatMap(c => c.products).filter(p => p.featured) }];
    return this.menu().filter(c => cat === null || c.id === cat)
      .map(c => ({ id: c.id, title: cat === null ? c.name : '', products: c.products }));
  });

  count = computed(() => this.lines().reduce((a, l) => a + l.quantity, 0));
  total = computed(() => this.lines().reduce((a, l) => a + l.quantity * l.product.price, 0));

  qty(id: number): number {
    return this.lines().find(l => l.product.id === id)?.quantity ?? 0;
  }

  noteOf(id: number): string {
    return this.lines().find(l => l.product.id === id)?.note ?? '';
  }

  add(p: MenuProduct): void {
    if (p.soldOut) return;
    this.setQty(p, this.qty(p.id) + 1);
    try { navigator.vibrate?.(12); } catch { /* */ }
  }

  dec(p: MenuProduct): void {
    this.setQty(p, this.qty(p.id) - 1);
  }

  setQty(p: MenuProduct, n: number): void {
    const quantity = Math.max(0, Math.min(99, n));
    this.lines.update(ls => {
      if (!quantity) return ls.filter(l => l.product.id !== p.id);
      return ls.some(l => l.product.id === p.id)
        ? ls.map(l => l.product.id === p.id ? { ...l, quantity } : l)
        : [...ls, { product: p, quantity }];
    });
    if (!this.lines().length) this.reviewing.set(false);
  }

  toggleNote(id: number): void {
    this.noteOpen.set(this.noteOpen() === id ? null : id);
  }

  setNote(p: MenuProduct, note: string): void {
    this.lines.update(ls => ls.map(l => l.product.id === p.id ? { ...l, note } : l));
  }

  async clear(): Promise<void> {
    if (this.count() > 2 && !(await this.dialogs.confirm({ title: '¿Vaciar el pedido?', message: `Se quitan los ${this.count()} productos que llevas.`, tone: 'danger', confirm: 'Vaciar pedido' }))) return;
    this.lines.set([]);
    this.reviewing.set(false);
  }

  send(): void {
    this.submit.emit({ lines: this.lines().map(l => ({ ...l, note: l.note?.trim() || undefined })), assignedTo: this.assignTo() });
  }
}
