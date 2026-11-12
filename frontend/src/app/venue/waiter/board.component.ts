import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api, errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Board, RoundView, TabView, TableBoard, WaiterOption } from '../../core/models';
import { AgoPipe, MoneyPipe, Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { WaiterHeaderComponent, notifyNew } from './waiter-header.component';
import { IconComponent } from '../../shared/icon.component';
import { Dialogs } from '../../shared/dialogs';

/** Tablero de mesas: lo usan meseros y administrador. */
@Component({
  selector: 'bx-board',
  standalone: true,
  imports: [FormsModule, RouterLink, MoneyPipe, AgoPipe, WaiterHeaderComponent, IconComponent],
  template: `
  <bx-waiter-header title="Mesas" />
  <main class="container page-wrap">
    @if (board() && !board()!.cashOpen) {
      <div class="card note"><bx-icon name="banknote" /> La caja está cerrada: se pueden cargar pedidos pero no cobrar.
        @if (auth.isAdmin()) { <a [routerLink]="'/' + ctx.slug() + '/admin/caja'">Abrir caja</a> }</div>
    }

    @if (board()?.calls?.length) {
      <section class="alerts">
        @for (c of board()!.calls; track c.id) {
          <div class="card alert call">
            <span class="big-ico" [class.bill]="c.type === 'BILL'"><bx-icon [name]="c.type === 'BILL' ? 'receipt' : 'hand'" /></span>
            <div class="grow"><p class="strong">{{ c.tableName }} {{ c.type === 'BILL' ? 'pide la cuenta' : 'te está llamando' }}</p><p class="tiny muted">{{ c.createdAt | ago }}</p></div>
            <button class="btn sm success" (click)="doneCall(c.id)">Listo</button>
          </div>
        }
      </section>
    }

    @if (board()?.pending?.length && !auth.isAdmin()) {
      <div class="card waiting"><bx-icon name="bell-ring" /> <span class="grow">@for (r of board()!.pending; track r.id; let last = $last) { <b>{{ r.tableName }}</b>@if (!last) {, } } pidió desde el QR · el administrador lo asigna</span></div>
    }
    @if (board()?.pending?.length && auth.isAdmin()) {
      <h2 class="sec"><bx-icon name="bell-ring" /> Pedidos desde las mesas</h2>
      <section class="alerts">
        @for (r of board()!.pending; track r.id) {
          <div class="card alert order pulse">
            <div class="row between"><p class="strong">{{ r.tableName }} @if (r.clientName) { <span class="muted">· {{ r.clientName }}</span> }</p><span class="tiny muted">{{ r.createdAt | ago }}</span></div>
            <ul>@for (i of r.items; track i.id) { <li><strong>{{ i.quantity }}×</strong> {{ i.productName }} @if (i.note) { <em class="muted">«{{ i.note }}»</em> }</li> }</ul>
            @if (r.note) { <p class="small muted">Nota: {{ r.note }}</p> }
              <div class="row wrap">
                <span class="strong num grow">{{ r.total | money }}</span>
                @if (!auth.alone(waiters())) {
                  <select class="input sel" [(ngModel)]="assignTo[r.id]">
                    <option [ngValue]="undefined">Asignar a…</option>
                    @for (w of waiters(); track w.id) { <option [ngValue]="w.id">{{ auth.staffLabel(w) }}</option> }
                  </select>
                  <button class="btn sm" [disabled]="!assignTo[r.id]" (click)="assign(r)">Asignar</button>
                }
                <button class="btn sm primary" (click)="takeIt(r)"><bx-icon name="hand" /> Yo lo llevo</button>
                <button class="btn sm danger" (click)="reject(r)">Rechazar</button>
              </div>

          </div>
        }
      </section>
    }

    @if (board()?.inProgress?.length) {
      <h2 class="sec"><bx-icon name="footprints" /> {{ auth.isAdmin() ? 'Por entregar' : 'Te toca llevar' }}</h2>
      <section class="alerts">
        @for (r of board()!.inProgress; track r.id) {
          <div class="card alert deliver">
            <div class="grow">
              <p class="strong">{{ r.tableName }} @if (auth.isAdmin()) { <span class="small" [class.muted]="!auth.isMe(r.assignedTo)" [class.strong]="auth.isMe(r.assignedTo)">· {{ auth.isMe(r.assignedTo) ? 'Tú' : r.assignedToName }}</span> }</p>
              <p class="small">@for (i of r.items; track i.id; let last = $last) { @if (!i.voided) { {{ i.quantity }}× {{ i.productName }}@if (!last) {, } } }</p>
            </div>
            <button class="btn sm success" (click)="deliver(r)">Entregada</button>
          </div>
        }
      </section>
    }

    <div class="head">
      <div class="zones">
        <button class="chip" [class.active]="zone() === null" (click)="zone.set(null)">Todas</button>
        <button class="chip" [class.active]="zone() === mineKey" (click)="zone.set(mineKey)"><bx-icon name="star" /> Mías</button>
        @for (z of zones(); track z) { <button class="chip" [class.active]="zone() === z" (click)="zone.set(z)">{{ z }}</button> }
      </div>
      <p class="tiny muted nowrap">{{ busyCount() }}/{{ board()?.tables?.length ?? 0 }} ocupadas</p>
    </div>

    <section class="tables">
      @for (t of visible(); track t.tableId) {
        <button class="tcard" [class.busy]="t.tabId" [class.attn]="t.pendingRounds || t.calls.length" (click)="open(t)">
          <span class="tname">{{ t.name }}</span>
          @if (t.pendingRounds || t.inProgress || t.calls.length) {
            <span class="icons">
              @if (t.pendingRounds) { <span class="badge pink"><bx-icon name="bell-ring" />{{ t.pendingRounds }}</span> }
              @if (t.inProgress) { <span class="badge teal"><bx-icon name="footprints" />{{ t.inProgress }}</span> }
              @if (t.calls.includes('BILL')) { <span class="badge amber"><bx-icon name="receipt" /></span> }
              @if (t.calls.includes('WAITER')) { <span class="badge amber"><bx-icon name="hand" /></span> }
            </span>
          }
          @if (t.tabId) {
            <p class="ttotal num">{{ t.consumed | money }}</p>
            <p class="tiny muted ellipsis">{{ t.openedAt | ago }}@if (t.due && t.due !== t.consumed) { · <span class="amber">debe {{ t.due | money }}</span> }</p>
            @if (t.waiterName) { <p class="tiny ellipsis cust">{{ t.customerName || t.waiterName }}</p> }
          } @else {
            <p class="free"><span class="go"><bx-icon name="plus" /></span> Libre</p>
          }
        </button>
      }
    </section>
  </main>`,
  styles: [`
    .page-wrap { padding-top: 16px; padding-bottom: 40px; }
    .note { margin-bottom: 14px; border-color: rgba(255,178,56,.4); }
    .note a { margin-left: 8px; font-weight: 700; }
    .sec { font-size: 16px; margin: 6px 0 10px; }
    .alerts { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
    .alert { display: flex; gap: 12px; }
    .alert.call { align-items: center; border-color: rgba(62,224,208,.4); }
    .alert.order { flex-direction: column; border-color: rgba(255,79,139,.5); gap: 8px; }
    .alert.deliver { align-items: center; border-color: rgba(74,222,128,.35); }
    .alert ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; }
    .sel { max-width: 180px; height: 34px; }
    .big-ico { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: rgba(94,194,171,.16); color: var(--c-teal); --icon-size: 22px; flex: none; }
    .big-ico.bill { background: rgba(255,178,56,.16); color: var(--c-amber); }
    .sec { display: flex; align-items: center; gap: 8px; }
    .sec bx-icon { color: var(--c-amber); }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .zones { flex: 1; min-width: 0; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
    .zones::-webkit-scrollbar { display: none; }
    .zones .chip { flex: none; height: 34px; }
    .waiting { display: flex; gap: 10px; align-items: center; padding: 10px 14px; margin-bottom: 14px; font-size: 13.5px; border-color: rgba(255,79,139,.4); }
    .tables { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    @media (max-width: 560px) { .tables { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .tcard { text-align: left; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--text); padding: 11px; min-height: 96px; min-width: 0; cursor: pointer; display: flex; flex-direction: column; gap: 2px; font: inherit; }
    .tcard:active { transform: scale(.97); }
    .tcard.busy { background: linear-gradient(var(--surface-2), var(--surface-2)) padding-box, var(--grad) border-box; border-color: transparent; }
    .tcard.attn { box-shadow: 0 0 0 3px rgba(255,79,139,.35); }
    .tname { font-weight: 800; font-size: 15.5px; line-height: 1.15; overflow-wrap: anywhere; }
    .ttotal { font-weight: 800; font-size: 18px; color: var(--c-amber); margin-top: auto; }
    .free { margin-top: auto; color: var(--faint); font-weight: 700; }
    .free { display: flex; align-items: center; gap: 6px; }
    .free .go { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 9px; background: var(--grad-soft); color: var(--c-pink); font-size: 18px; }
    .cust { color: var(--c-teal); }
    .amber { color: var(--c-amber); }
    .icons { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; font-size: 13px; }
    .icons .badge { height: 19px; padding: 0 6px; font-size: 11px; }
  `],
})
export class BoardComponent implements OnInit {
  private dialogs = inject(Dialogs);
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  private destroyRef = inject(DestroyRef);
  auth = inject(Auth);
  ctx = inject(VenueContext);

  board = signal<Board | null>(null);
  waiters = signal<WaiterOption[]>([]);
  zone = signal<string | null>(null);
  assignTo: Record<number, number | undefined> = {};
  private seen = new Set<string>();
  private first = true;

  zones = computed(() => [...new Set((this.board()?.tables ?? []).map(t => t.zone).filter((z): z is string => !!z))]);
  readonly mineKey = '__mine__';
  visible = computed(() => (this.board()?.tables ?? []).filter(t => {
    const z = this.zone();
    if (z === this.mineKey) return !!t.tabId && t.waiterName === this.auth.user()?.name;
    return !z || t.zone === z;
  }));
  busyCount = computed(() => (this.board()?.tables ?? []).filter(t => t.tabId).length);

  ngOnInit(): void {
    if (!this.auth.isSupport()) this.auth.rememberAdminHome('mesero');
    if (this.auth.isAdmin()) this.api.get<WaiterOption[]>('/staff/waiters').subscribe(w => this.waiters.set(w));
    timer(0, 5000).pipe(
      switchMap(() => this.api.get<Board>('/staff/board').pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(b => b && this.apply(b));
  }

  async open(t: TableBoard): Promise<void> {
    if (t.tabId) {
      this.router.navigate(['/', this.ctx.slug(), 'mesero', 'cuenta', t.tabId]);
      return;
    }
    try {
      const tab = await this.api.run(this.api.post<TabView>(`/staff/tables/${t.tableId}/open`, {}));
      this.router.navigate(['/', this.ctx.slug(), 'mesero', 'cuenta', tab.id], { queryParams: { agregar: 1 } });
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async assign(r: RoundView): Promise<void> {
    await this.act(`/admin/rounds/${r.id}/assign`, { waiterId: this.assignTo[r.id] }, `Pedido de ${r.tableName} asignado`);
  }

  /** El administrador también atiende: se asigna el pedido a sí mismo con un toque. */
  async takeIt(r: RoundView): Promise<void> {
    await this.act(`/admin/rounds/${r.id}/assign`, { waiterId: this.auth.user()!.id }, `Pedido de ${r.tableName}: lo llevas tú`);
  }

  async reject(r: RoundView): Promise<void> {
    const reason = await this.dialogs.prompt({ title: `¿Rechazar el pedido de ${r.tableName ?? 'la mesa'}?`, tone: 'danger', confirm: 'Rechazar pedido',
      input: { label: 'Motivo (lo verá el cliente)', value: 'No disponible', required: true } });
    if (reason === null) return;
    await this.act(`/admin/rounds/${r.id}/reject`, { reason }, 'Pedido rechazado');
  }

  async deliver(r: RoundView): Promise<void> {
    await this.act(`/staff/rounds/${r.id}/deliver`, {}, `Entregado en ${r.tableName}`);
  }

  async doneCall(id: number): Promise<void> {
    await this.act(`/staff/calls/${id}/done`, {}, 'Atendido');
  }

  private async act(path: string, body: unknown, ok: string): Promise<void> {
    try {
      await this.api.run(this.api.post(path, body));
      this.toasts.ok(ok);
      this.api.get<Board>('/staff/board').subscribe(b => this.apply(b));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  private apply(b: Board): void {
    const keys = [...b.pending.map(r => 'p' + r.id), ...b.inProgress.map(r => 'd' + r.id), ...b.calls.map(c => 'c' + c.id)];
    const fresh = keys.some(k => !this.seen.has(k));
    keys.forEach(k => this.seen.add(k));
    if (fresh && !this.first) notifyNew();
    this.first = false;
    this.board.set(b);
  }
}
