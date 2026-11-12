import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api, errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Item, MenuCategory, PAYMENT_LABELS, PaymentMethod, ROUND_LABELS, RoundView, TabView, TableBoard, WaiterOption } from '../../core/models';
import { AgoPipe, HourPipe, MoneyPipe, Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { PickedLine, ProductPickerComponent } from './product-picker.component';
import { WaiterHeaderComponent } from './waiter-header.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'bx-tab',
  standalone: true,
  imports: [FormsModule, MoneyPipe, AgoPipe, HourPipe, ProductPickerComponent, WaiterHeaderComponent, IconComponent],
  templateUrl: './tab.component.html',
  styleUrl: './tab.component.scss',
})
export class TabComponent implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toasts = inject(Toasts);
  private destroyRef = inject(DestroyRef);
  auth = inject(Auth);
  ctx = inject(VenueContext);

  id = input.required<string>();
  tab = signal<TabView | null>(null);
  menu = signal<MenuCategory[]>([]);
  waiters = signal<WaiterOption[]>([]);
  picking = signal(false);
  busy = signal(false);

  charging = signal(false);
  selected = signal<Set<number>>(new Set());
  discount = 0;
  tip = 0;
  method: PaymentMethod = 'CASH';
  note = '';
  release = true;
  methods = Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][];
  labels = PAYMENT_LABELS;
  roundLabels = ROUND_LABELS;

  moving = signal(false);
  freeTables = signal<TableBoard[]>([]);

  rounds = computed(() => (this.tab()?.rounds ?? []).slice().reverse());
  payable = computed(() => (this.tab()?.rounds ?? []).filter(r => (r.status === 'CONFIRMED' || r.status === 'DELIVERED') && !r.paid && r.total > 0));
  selectedTotal = computed(() => this.payable().filter(r => this.selected().has(r.id)).reduce((a, r) => a + r.total, 0));
  allSelected = computed(() => this.payable().length > 0 && this.payable().every(r => this.selected().has(r.id)));
  backUrl = computed(() => `/${this.ctx.slug()}/mesero`);

  ngOnInit(): void {
    this.api.get<MenuCategory[]>('/staff/menu').subscribe(m => this.menu.set(m));
    if (this.auth.isAdmin()) this.api.get<WaiterOption[]>('/staff/waiters').subscribe(w => this.waiters.set(w));
    // Primera carga siempre, aunque se abra directo en "nuevo pedido" (el sondeo se pausa mientras tanto).
    this.reload();
    timer(6000, 6000).pipe(
      switchMap(() => this.charging() || this.picking() ? of(null)
        : this.api.get<TabView>(`/staff/tabs/${this.id()}`).pipe(catchError(e => { this.toasts.error(errorMessage(e)); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(t => t && this.tab.set(t));
    if (this.route.snapshot.queryParamMap.get('agregar')) {
      this.justOpened = true;
      this.picking.set(true);
    }
  }

  /** La mesa se abrió para tomar un pedido: si se cancela sin pedir nada, se libera sola. */
  private justOpened = false;

  private reload(): void {
    this.api.get<TabView>(`/staff/tabs/${this.id()}`).subscribe({ next: t => this.tab.set(t), error: e => this.toasts.error(errorMessage(e)) });
  }

  async closePicker(): Promise<void> {
    this.picking.set(false);
    const t = this.tab();
    if (this.justOpened && t && t.status === 'OPEN' && !t.rounds.length) {
      try { await this.api.run(this.api.post(`/staff/tabs/${this.id()}/release`)); } catch { /* queda abierta */ }
      this.router.navigateByUrl(this.backUrl());
      return;
    }
    this.justOpened = false;
    this.reload();
  }

  isMine(r: RoundView): boolean {
    return r.assignedTo === this.auth.user()?.id;
  }

  async addRound(e: { lines: PickedLine[]; assignedTo: number | null }): Promise<void> {
    this.busy.set(true);
    try {
      this.tab.set(await this.api.run(this.api.post<TabView>(`/staff/tabs/${this.id()}/rounds`, {
        items: e.lines.map(l => ({ productId: l.product.id, quantity: l.quantity, note: l.note?.trim() || null })),
        assignedTo: e.assignedTo,
      })));
      this.picking.set(false);
      this.justOpened = false;
      this.toasts.ok('Pedido enviado ✓');
      this.api.get<MenuCategory[]>('/staff/menu').subscribe(m => this.menu.set(m));
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async deliver(r: RoundView): Promise<void> {
    await this.run(`/staff/rounds/${r.id}/deliver`, {});
  }

  async assign(r: RoundView, waiterId: number): Promise<void> {
    if (!waiterId) return;
    await this.run(`/admin/rounds/${r.id}/assign`, { waiterId }, 'Asignado');
  }

  async reject(r: RoundView): Promise<void> {
    const reason = prompt('¿Por qué se rechaza? (lo verá el cliente)', 'No disponible');
    if (reason === null) return;
    await this.run(`/admin/rounds/${r.id}/reject`, { reason });
  }

  async changeQty(i: Item): Promise<void> {
    const v = prompt(`Nueva cantidad para «${i.productName}» (ahora ${i.quantity}):`, String(i.quantity));
    if (v === null) return;
    const quantity = Number(v);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) { this.toasts.error('Cantidad no válida'); return; }
    const reason = prompt('Motivo del cambio:');
    if (!reason?.trim()) return;
    await this.run(`/admin/items/${i.id}/quantity`, { quantity, reason }, 'Cantidad cambiada');
  }

  async voidItem(i: Item): Promise<void> {
    const reason = prompt(`¿Por qué se anula «${i.quantity} × ${i.productName}»?`);
    if (!reason?.trim()) return;
    await this.run(`/admin/items/${i.id}/void`, { reason }, 'Producto anulado');
  }

  async setWaiter(waiterId: number): Promise<void> {
    await this.run(`/admin/tabs/${this.id()}/waiter`, { waiterId }, 'Mesero de la mesa cambiado');
  }

  // ---------- Cobro ----------

  openCharge(only?: RoundView): void {
    this.selected.set(new Set(only ? [only.id] : this.payable().map(r => r.id)));
    this.discount = 0;
    this.tip = 0;
    this.method = 'CASH';
    this.note = '';
    this.release = !only;
    this.charging.set(true);
  }

  toggle(id: number): void {
    this.selected.update(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  suggestTip(): void {
    this.tip = Math.round((this.selectedTotal() * 0.1) / 100) * 100;
  }

  finalTotal(): number {
    return Math.max(0, this.selectedTotal() - (Number(this.discount) || 0)) + (Number(this.tip) || 0);
  }

  async charge(): Promise<void> {
    if (!this.selected().size) return;
    this.busy.set(true);
    try {
      const t = await this.api.run(this.api.post<TabView>(`/staff/tabs/${this.id()}/charge`, {
        roundIds: [...this.selected()], discount: Number(this.discount) || 0, tip: Number(this.tip) || 0,
        method: this.method, note: this.note || null, release: this.release && this.allSelected(),
      }));
      this.charging.set(false);
      this.toasts.ok(this.auth.isAdmin() ? 'Cobro registrado' : 'Cobro registrado. Entrega el dinero en caja.');
      if (t.status !== 'OPEN') this.router.navigateByUrl(this.backUrl());
      else this.tab.set(t);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async releaseTable(): Promise<void> {
    if (!confirm('¿Liberar la mesa? La cuenta queda cerrada.')) return;
    try {
      await this.api.run(this.api.post(`/staff/tabs/${this.id()}/release`));
      this.router.navigateByUrl(this.backUrl());
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  openMove(): void {
    this.api.get<{ tables: TableBoard[] }>('/staff/board').subscribe(b => {
      this.freeTables.set(b.tables.filter(t => !t.tabId));
      this.moving.set(true);
    });
  }

  async move(t: TableBoard): Promise<void> {
    this.moving.set(false);
    await this.run(`/staff/tabs/${this.id()}/move`, { tableId: t.tableId }, `Cuenta pasada a ${t.name}`);
  }

  async saveCustomer(): Promise<void> {
    const t = this.tab();
    if (!t) return;
    const name = prompt('Nombre o referencia de la cuenta', t.customerName ?? '');
    if (name === null) return;
    await this.run(`/staff/tables/${t.tableId}/open`, { customerName: name });
  }

  printBill(): void {
    window.print();
  }

  private async run(path: string, body: unknown, ok?: string): Promise<void> {
    try {
      this.tab.set(await this.api.run(this.api.post<TabView>(path, body)));
      if (ok) this.toasts.ok(ok);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
