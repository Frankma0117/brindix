import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api, errorMessage } from '../core/api.service';
import { Category, Item, PAYMENT_LABELS, PaymentMethod, Product, RoundView, TabView, TableBoard } from '../core/models';
import { AgoPipe, HourPipe, MoneyPipe, Toasts } from '../core/ui';
import { PickedLine, ProductPickerComponent } from './product-picker.component';
import { WaiterHeaderComponent } from './waiter-header.component';

@Component({
  selector: 'bx-tab',
  standalone: true,
  imports: [FormsModule, MoneyPipe, AgoPipe, HourPipe, ProductPickerComponent, WaiterHeaderComponent],
  templateUrl: './tab.component.html',
  styleUrl: './tab.component.scss',
})
export class TabComponent implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toasts = inject(Toasts);
  private destroyRef = inject(DestroyRef);

  id = input.required<string>();
  tab = signal<TabView | null>(null);
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  picking = signal(false);
  busy = signal(false);

  closing = signal(false);
  discount = 0;
  tip = 0;
  method: PaymentMethod = 'CASH';
  methods = Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][];
  labels = PAYMENT_LABELS;
  roundLabels = { PENDING: 'Por confirmar', CONFIRMED: 'Confirmada', DELIVERED: 'Entregada', REJECTED: 'Rechazada' };

  moving = signal(false);
  freeTables = signal<TableBoard[]>([]);

  rounds = computed(() => (this.tab()?.rounds ?? []).slice().reverse());
  closeTotal = computed(() => this.tab()?.subtotal ?? 0);

  ngOnInit(): void {
    this.api.get<Product[]>('/staff/products').subscribe(p => this.products.set(p.filter(x => x.available || x.trackStock)));
    this.api.get<Category[]>('/staff/categories').subscribe(c => this.categories.set(c.filter(x => x.active)));
    timer(0, 6000).pipe(
      switchMap(() => this.closing() || this.picking() ? of(null)
        : this.api.get<TabView>(`/staff/tabs/${this.id()}`).pipe(catchError(e => { this.toasts.error(errorMessage(e)); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(t => t && this.tab.set(t));
    if (this.route.snapshot.queryParamMap.get('agregar')) this.picking.set(true);
  }

  async addRound(lines: PickedLine[]): Promise<void> {
    this.busy.set(true);
    try {
      const t = await this.api.run(this.api.post<TabView>(`/staff/tabs/${this.id()}/rounds`, {
        items: lines.map(l => ({ productId: l.product.id, quantity: l.quantity, note: l.note?.trim() || null })),
      }));
      this.tab.set(t);
      this.picking.set(false);
      this.toasts.ok('Ronda cargada');
      this.api.get<Product[]>('/staff/products').subscribe(p => this.products.set(p.filter(x => x.available || x.trackStock)));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async roundAction(r: RoundView, action: 'confirm' | 'reject' | 'deliver'): Promise<void> {
    let body: unknown = {};
    if (action === 'reject') {
      const reason = prompt('¿Por qué se rechaza? (lo verá el cliente)', 'No disponible');
      if (reason === null) return;
      body = { reason };
    }
    await this.run(`/staff/rounds/${r.id}/${action}`, body);
  }

  async voidItem(i: Item): Promise<void> {
    const reason = prompt(`¿Por qué se anula «${i.quantity} × ${i.productName}»?`);
    if (!reason?.trim()) return;
    await this.run(`/staff/items/${i.id}/void`, { reason });
  }

  openClose(): void {
    this.discount = 0;
    this.tip = 0;
    this.method = 'CASH';
    this.closing.set(true);
  }

  suggestTip(): void {
    this.tip = Math.round((this.closeTotal() * 0.1) / 100) * 100;
  }

  finalTotal(): number {
    return Math.max(0, this.closeTotal() - (Number(this.discount) || 0)) + (Number(this.tip) || 0);
  }

  async close(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.run(this.api.post<TabView>(`/staff/tabs/${this.id()}/close`, {
        discount: Number(this.discount) || 0, tip: Number(this.tip) || 0, paymentMethod: this.method,
      }));
      this.toasts.ok('Cuenta cobrada. ¡Mesa libre!');
      this.router.navigateByUrl('/mesero');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async cancelTab(): Promise<void> {
    if (!confirm('¿Cancelar esta cuenta? Solo se puede si no tiene consumo.')) return;
    try {
      await this.api.run(this.api.post(`/staff/tabs/${this.id()}/cancel`));
      this.router.navigateByUrl('/mesero');
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
    try {
      this.tab.set(await this.api.run(this.api.post<TabView>(`/staff/tables/${t.tableId}/open`, { customerName: name })));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
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
