import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { CASH_LABELS, CashCategory, PAYMENT_LABELS, PaymentMethod, PaymentView, ShiftReport, ShiftRow, ShiftStatus } from '../../core/models';
import { HourPipe, MoneyPipe, Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { IconComponent } from '../../shared/icon.component';

interface CashState { open: boolean; shift: ShiftStatus | Record<string, never>; unsettled: PaymentView[]; }

/** Caja del día: base, dinero de meseros, recibos y compras pagados, cierre con conteo y reporte. */
@Component({
  selector: 'bx-cash',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe, MoneyPipe, HourPipe],
  templateUrl: './cash.component.html',
  styles: [`
    .open-box { max-width: 520px; display: flex; flex-direction: column; gap: 14px; }
    .flow { display: grid; gap: 8px; }
    .fl { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--line); font-variant-numeric: tabular-nums; }
    .fl.total { border: 0; font-size: 22px; font-weight: 800; }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--red); flex: none; }
    .dot.in { background: var(--green); }
    .neg { color: var(--ink-red); } .pos { color: var(--ink-green); }
    .mv { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); }
    .mv:last-child { border: 0; }
    .layout { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; align-items: start; margin-top: 16px; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
    .diff { font-size: 26px; font-weight: 800; }
    .report h3 { margin: 18px 0 8px; }
    .report .table td, .report .table th { padding: 7px 8px; }
    .head-print { display: none; }
    @media print {
      :host ::ng-deep .side, :host ::ng-deep .mobile-top { display: none !important; }
      .no-print { display: none !important; }
      .report-wrap { position: static !important; background: #fff !important; padding: 0 !important; }
      .report { box-shadow: none !important; border: 0 !important; max-height: none !important; color: #000; background: #fff !important; }
      .report * { color: #000 !important; }
      .head-print { display: block; }
    }
  `],
})
export class CashComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  ctx = inject(VenueContext);

  state = signal<CashState | null>(null);
  history = signal<ShiftRow[]>([]);
  report = signal<ShiftReport | null>(null);
  closing = signal(false);
  busy = signal(false);

  openingCash: number | null = null;
  openingNote = '';
  mv = { direction: 'OUT' as 'IN' | 'OUT', category: 'BILL' as CashCategory, method: 'CASH', amount: null as number | null, description: '' };
  counted: number | null = null;
  closingNote = '';

  cashLabels = CASH_LABELS;
  categories = Object.entries(CASH_LABELS) as [CashCategory, string][];
  payLabels = PAYMENT_LABELS;
  methods = Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][];

  shift(): ShiftStatus | null {
    const s = this.state();
    return s?.open ? s.shift as ShiftStatus : null;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<CashState>('/admin/cash').subscribe(s => this.state.set(s));
    this.api.get<ShiftRow[]>('/admin/cash/shifts').subscribe(h => this.history.set(h));
  }

  async open(): Promise<void> {
    if (this.openingCash === null) return;
    await this.run(() => this.api.run(this.api.post('/admin/cash/open', { openingCash: Number(this.openingCash), note: this.openingNote })), 'Caja abierta');
  }

  async addMovement(): Promise<void> {
    if (!this.mv.amount || !this.mv.description.trim()) return;
    await this.run(() => this.api.run(this.api.post('/admin/cash/movements', { ...this.mv, amount: Number(this.mv.amount) })), 'Movimiento registrado');
    this.mv = { ...this.mv, amount: null, description: '' };
  }

  async deleteMovement(id: number): Promise<void> {
    if (!confirm('¿Borrar este movimiento? Queda registrado en la bitácora.')) return;
    await this.run(() => this.api.run(this.api.delete(`/admin/cash/movements/${id}`)), 'Movimiento borrado');
  }

  async settle(p: PaymentView): Promise<void> {
    await this.run(() => this.api.run(this.api.post(`/admin/payments/${p.id}/settle`)), `Recibido de ${p.collectedByName}`);
  }

  async voidPayment(p: PaymentView): Promise<void> {
    const reason = prompt(`¿Por qué se anula el cobro de ${p.tableName} (${p.total})? Las rondas vuelven a quedar por cobrar.`);
    if (!reason?.trim()) return;
    await this.run(() => this.api.run(this.api.post(`/admin/payments/${p.id}/void`, { reason })), 'Cobro anulado');
  }

  difference(): number | null {
    const s = this.shift();
    if (!s || this.counted === null || (this.counted as unknown) === '') return null;
    return Number(this.counted) - s.expectedCash;
  }

  async close(): Promise<void> {
    if (this.counted === null) return;
    this.busy.set(true);
    try {
      const r = await this.api.run(this.api.post<ShiftReport>('/admin/cash/close', { countedCash: Number(this.counted), note: this.closingNote }));
      this.closing.set(false);
      this.counted = null;
      this.closingNote = '';
      this.report.set(r);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  viewReport(id?: number): void {
    this.api.get<ShiftReport>(id ? `/admin/cash/report/${id}` : '/admin/cash/report').subscribe({
      next: r => this.report.set(r),
      error: e => this.toasts.error(errorMessage(e)),
    });
  }

  print(): void {
    window.print();
  }

  payLabel(k: string): string {
    return PAYMENT_LABELS[k as PaymentMethod] ?? k;
  }

  private async run(fn: () => Promise<unknown>, ok: string): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
      this.toasts.ok(ok);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
