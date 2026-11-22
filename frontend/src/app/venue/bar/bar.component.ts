import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api, errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { BarItem, BarQueue } from '../../core/models';
import { AgoPipe, Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { IconComponent } from '../../shared/icon.component';
import { WaiterHeaderComponent } from '../waiter/waiter-header.component';

interface Ticket { tabId: number; tableName: string; at: string; items: BarItem[]; }

/** Barra: cola de preparación. La usa el bartender (o el administrador en bares pequeños). */
@Component({
  selector: 'bx-bar',
  standalone: true,
  imports: [RouterLink, DecimalPipe, AgoPipe, WaiterHeaderComponent, IconComponent],
  template: `
  <bx-waiter-header title="Barra" />
  <main class="container page-wrap">
    @if (auth.isAdmin()) {
      <p class="row"><a class="btn sm" [routerLink]="'/' + ctx.slug() + '/mesero'"><bx-icon name="martini" /> Ir a mesas</a></p>
    }
    @if (loaded() && !tickets().length) {
      <div class="card empty"><bx-icon name="chef-hat" /><p class="strong">Nada por preparar</p><p class="small muted">Cuando una ronda con tragos de barra se confirme, aparece aquí.</p></div>
    }
    <section class="tickets">
      @for (t of tickets(); track t.tabId) {
        <article class="card ticket">
          <header class="row between">
            <h2 class="table">{{ t.tableName }}</h2>
            <span class="small muted">{{ t.at | ago }}</span>
          </header>
          @for (i of t.items; track i.id) {
            <div class="line">
              <div class="info">
                <p class="name"><span class="qty num">{{ i.quantity }}×</span> {{ i.productName }}</p>
                @if (i.note) { <p class="note"><bx-icon name="sticky-note" /> {{ i.note }}</p> }
                @if (i.recipe.length) {
                  <button class="btn xs ghost" (click)="toggle(i.id)" [attr.aria-expanded]="open().has(i.id)">
                    <bx-icon [name]="open().has(i.id) ? 'chevron-down' : 'chevron-right'" /> Receta
                  </button>
                  @if (open().has(i.id)) {
                    <ul class="recipe">
                      @for (l of i.recipe; track l.ingredient) {
                        <li><span>{{ l.ingredient }}</span><b class="num">{{ l.quantity * i.quantity | number: '1.0-2' }} {{ l.unit }}</b></li>
                      }
                    </ul>
                  }
                }
              </div>
              <button class="btn success ready" [disabled]="busy().has(i.id)" (click)="ready(i)"><bx-icon name="check" /> Listo</button>
            </div>
          }
        </article>
      }
    </section>
  </main>`,
  styles: [`
    .tickets { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; margin-top: 12px; align-items: start; }
    .ticket { display: flex; flex-direction: column; gap: 10px; }
    .table { font-size: 22px; font-weight: 800; }
    .line { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--line); }
    .info { flex: 1; min-width: 0; }
    .name { font-size: 20px; font-weight: 750; line-height: 1.25; }
    .qty { color: var(--c-amber, var(--amber)); margin-right: 4px; }
    .note { font-size: 15px; color: var(--muted); margin-top: 2px; }
    .recipe { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; font-size: 15px; }
    .recipe li { display: flex; justify-content: space-between; gap: 12px; }
    .ready { min-width: 112px; min-height: 64px; font-size: 18px; font-weight: 800; flex: none; transition: transform 120ms ease-out; }
    .ready:active { transform: scale(.97); }
    .empty { text-align: center; padding: 40px 16px; display: grid; gap: 6px; justify-items: center; }
  `],
})
export class BarComponent implements OnInit {
  auth = inject(Auth);
  ctx = inject(VenueContext);
  private api = inject(Api);
  private toasts = inject(Toasts);
  private destroyRef = inject(DestroyRef);

  loaded = signal(false);
  tickets = signal<Ticket[]>([]);
  open = signal<Set<number>>(new Set());
  busy = signal<Set<number>>(new Set());

  ngOnInit(): void {
    if (!this.auth.isSupport()) this.auth.rememberAdminHome('barra');
    timer(0, 10000).pipe(
      switchMap(() => document.hidden ? of(null) : this.api.get<BarQueue>('/staff/bar/queue').pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(q => q && this.apply(q));
  }

  toggle(id: number): void {
    const s = new Set(this.open());
    s.has(id) ? s.delete(id) : s.add(id);
    this.open.set(s);
  }

  async ready(i: BarItem): Promise<void> {
    this.busy.update(s => new Set(s).add(i.id));
    try {
      await this.api.run(this.api.post(`/staff/bar/items/${i.id}/ready`, {}));
      // Quita el ítem al instante; el siguiente refresco confirma.
      this.tickets.update(ts => ts.map(t => ({ ...t, items: t.items.filter(x => x.id !== i.id) })).filter(t => t.items.length));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.update(s => { const n = new Set(s); n.delete(i.id); return n; });
    }
  }

  /** Un ticket por mesa y ronda, del más antiguo al más nuevo. */
  private apply(q: BarQueue): void {
    const byRound = new Map<number, Ticket>();
    for (const i of q.items) {
      const t = byRound.get(i.roundId) ?? { tabId: i.roundId, tableName: i.tableName, at: i.at, items: [] };
      t.items.push(i);
      byRound.set(i.roundId, t);
    }
    this.tickets.set([...byRound.values()].sort((a, b) => a.at.localeCompare(b.at)));
    this.loaded.set(true);
  }
}
