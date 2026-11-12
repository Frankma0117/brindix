import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { IconComponent } from './icon.component';

export interface ResetRequest {
  id: number; venueId: number; venueName: string; userName: string; username: string; role: 'ADMIN' | 'WAITER';
  status: 'PENDING' | 'APPROVED'; requestedAt: string; approvedBy?: string; expiresAt?: string; mine: boolean;
}
interface ApprovedCode { code: string; expiresAt: string; userName: string; username: string; }

/**
 * Solicitudes de recuperación de contraseña. En el bar (base '/admin') las aprueba otro administrador;
 * en la plataforma (base '/platform') el súper administrador. Al aprobar se muestra el código una sola vez.
 */
@Component({
  selector: 'bx-reset-requests',
  standalone: true,
  imports: [DatePipe, IconComponent],
  template: `
  @if (items().length) {
    <section class="card reqs">
      <div class="head"><bx-icon name="shield-check" /><h3>Recuperación de contraseña</h3><span class="badge pink">{{ items().length }}</span></div>
      <p class="small muted">Verifica que la persona sea quien dice antes de aprobar. Le darás un código de un solo uso que vence en 30 minutos; con él elige su nueva contraseña (tú nunca la ves).</p>
      @for (r of items(); track r.id) {
        <div class="req">
          <div class="grow">
            <p class="strong">{{ r.userName }} <span class="muted small">· {{ r.username }} · {{ r.role === 'ADMIN' ? 'Administrador' : 'Mesero' }}@if (showVenue()) { · {{ r.venueName }} }</span></p>
            <p class="tiny muted">Pedida {{ r.requestedAt | date: 'd MMM, h:mm a' }}
              @if (r.status === 'APPROVED') { · código entregado por {{ r.approvedBy }}, vence {{ r.expiresAt | date: 'h:mm a' }} }</p>
          </div>
          @if (r.mine) {
            <span class="small muted">Debe aprobarla otro administrador o Brindix</span>
          } @else {
            <button class="btn sm danger" [disabled]="busy()" (click)="reject(r)">Rechazar</button>
            <button class="btn sm primary" [disabled]="busy()" (click)="approve(r)">{{ r.status === 'APPROVED' ? 'Nuevo código' : 'Aprobar' }}</button>
          }
        </div>
      }
    </section>
  }

  @if (code(); as c) {
    <div class="backdrop" (click)="code.set(null)">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog" aria-label="Código de recuperación">
        <div class="modal-head"><h2>Código para {{ c.userName }}</h2><button class="btn icon sm" (click)="code.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <p class="muted">Dáselo en persona o por un canal de confianza. Vence a las <b>{{ c.expiresAt | date: 'h:mm a' }}</b> y sirve una sola vez.</p>
        <p class="code num">{{ c.code }}</p>
        <p class="small muted">En la pantalla de ingreso: <b>¿Olvidaste tu contraseña?</b> → <b>Ya tengo un código</b>, con el usuario <b>{{ c.username }}</b>.</p>
        <div class="modal-foot"><button class="btn" (click)="copy(c.code)"><bx-icon name="check" /> Copiar código</button><button class="btn primary" (click)="code.set(null)">Listo</button></div>
      </div>
    </div>
  }`,
  styles: [`
    .reqs { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; border-color: rgba(255,92,108,.4); }
    .head { display: flex; align-items: center; gap: 8px; }
    .head bx-icon { color: var(--c-pink); }
    .req { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--line); }
    .code { font-size: 40px; font-weight: 800; letter-spacing: .12em; text-align: center; padding: 18px; margin: 14px 0; border-radius: 14px; background: var(--surface-2); user-select: all; }
  `],
})
export class ResetRequestsComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  /** '/admin' (bar) o '/platform'. */
  base = input('/admin');
  showVenue = input(false);
  count = output<number>();
  items = signal<ResetRequest[]>([]);
  code = signal<ApprovedCode | null>(null);
  busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<ResetRequest[]>(`${this.base()}/password-requests`).subscribe({
      next: l => { this.items.set(l); this.count.emit(l.filter(r => !r.mine).length); },
      error: () => {},
    });
  }

  async approve(r: ResetRequest): Promise<void> {
    if (!confirm(`¿Confirmaste que ${r.userName} es quien pide recuperar su cuenta?`)) return;
    await this.act(async () => this.code.set(await this.api.run(this.api.post<ApprovedCode>(`${this.base()}/password-requests/${r.id}/approve`, {}))));
  }

  async reject(r: ResetRequest): Promise<void> {
    if (!confirm(`¿Rechazar la solicitud de ${r.userName}?`)) return;
    await this.act(async () => { await this.api.run(this.api.post(`${this.base()}/password-requests/${r.id}/reject`, {})); this.toasts.ok('Solicitud rechazada'); });
  }

  copy(code: string): void {
    navigator.clipboard?.writeText(code).then(() => this.toasts.ok('Código copiado'), () => {});
  }

  private async act(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try { await fn(); this.load(); } catch (e) { this.toasts.error(errorMessage(e)); } finally { this.busy.set(false); }
  }
}
