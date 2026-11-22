import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { INGREDIENT_MOVEMENT_LABELS, Ingredient, IngredientMovement, IngredientMovementType } from '../../core/models';
import { MoneyPipe, Toasts } from '../../core/ui';
import { IconComponent } from '../../shared/icon.component';
import { Dialogs } from '../../shared/dialogs';

interface IngredientForm { id?: number; name: string; unit: string; minStock: number | null; }

/** Insumos de las recetas (ron en shots, jugo en ml, limones en und): existencias, entradas, mermas y conteos. */
@Component({
  selector: 'bx-ingredients',
  standalone: true,
  imports: [FormsModule, MoneyPipe, DatePipe, DecimalPipe, IconComponent],
  template: `
  <div class="page-head">
    <div><h1>Insumos y recetas</h1><p>Lo que se gasta al vender un coctel o un plato. El costo de cada insumo se promedia solo con cada entrada; las recetas se arman en Carta y productos.</p></div>
    <div class="row"><button class="btn primary" (click)="openForm()"><bx-icon name="plus" /> Nuevo insumo</button></div>
  </div>

  <div class="row wrap filters">
    <label class="search grow"><input class="input" placeholder="Buscar insumo" [ngModel]="q()" (ngModelChange)="q.set($event)"></label>
    <label class="check"><input type="checkbox" [ngModel]="onlyLow()" (ngModelChange)="onlyLow.set($event)"> Solo por reponer</label>
  </div>

  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Insumo</th><th class="right">Existencia</th><th class="right">Mínimo</th><th class="right">Costo por unidad</th><th class="right">Valor</th><th></th></tr></thead>
      <tbody>
        @for (i of visible(); track i.id) {
          <tr>
            <td class="strong">{{ i.name }}</td>
            <td class="right"><span class="badge" [class.red]="i.stock <= 0" [class.amber]="i.low && i.stock > 0" [class.green]="!i.low">{{ i.stock | number: '1.0-3' }} {{ i.unit }}</span></td>
            <td class="right muted">{{ i.minStock != null ? (i.minStock | number: '1.0-3') : '—' }}</td>
            <td class="right num">{{ i.avgCost ? (i.avgCost | number: '1.0-2') : '—' }}</td>
            <td class="right num muted">{{ i.avgCost && i.stock > 0 ? (i.avgCost * i.stock | money) : '—' }}</td>
            <td class="right nowrap">
              <button class="btn xs" (click)="openMove(i, 'ENTRY')">Entrada</button>
              <button class="btn xs" (click)="openMove(i, 'WASTE')">Merma</button>
              <button class="btn xs" (click)="openMove(i, 'ADJUST')">Conteo</button>
              <button class="btn xs" (click)="openHistory(i)">Historial</button>
              <button class="btn icon xs ghost" (click)="openForm(i)" aria-label="Editar"><bx-icon name="pencil" /></button>
            </td>
          </tr>
        } @empty { <tr><td colspan="6" class="muted">Aún no hay insumos. Crea el primero (por ejemplo «Ron», en shot).</td></tr> }
      </tbody>
    </table>
  </div>

  @if (form(); as f) {
    <div class="backdrop" (click)="form.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ f.id ? 'Editar insumo' : 'Nuevo insumo' }}</h2><button class="btn icon sm" (click)="form.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="col">
          <label class="field"><span>Nombre</span><input class="input" maxlength="120" [(ngModel)]="f.name" placeholder="Ej: Ron blanco"></label>
          <div class="form-grid">
            <label class="field"><span>Unidad</span><input class="input" maxlength="10" [(ngModel)]="f.unit" placeholder="ml, g, und, shot"></label>
            <label class="field"><span>Avisar cuando queden</span><input class="input" type="number" min="0" [(ngModel)]="f.minStock" placeholder="Opcional"></label>
          </div>
        </div>
        <div class="modal-foot">
          @if (f.id) { <button class="btn danger" style="margin-right: auto" (click)="archive(f)">Archivar</button> }
          <button class="btn" (click)="form.set(null)">Cancelar</button>
          <button class="btn primary" [disabled]="busy() || !f.name.trim() || !f.unit.trim()" (click)="saveForm()">Guardar</button>
        </div>
      </div>
    </div>
  }

  @if (move(); as m) {
    <div class="backdrop" (click)="move.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ moveTitle() }} · {{ m.ing.name }}</h2><button class="btn icon sm" (click)="move.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="col">
          <p class="muted small">Hay {{ m.ing.stock | number: '1.0-3' }} {{ m.ing.unit }}.</p>
          <label class="field"><span>{{ qtyLabel() }} ({{ m.ing.unit }})</span><input class="input" type="number" min="0" step="any" [(ngModel)]="qty"></label>
          @if (m.type === 'ENTRY') {
            <div class="row wrap">
              <button class="chip" [class.active]="costMode === 'total'" (click)="costMode = 'total'">Costo total de la compra</button>
              <button class="chip" [class.active]="costMode === 'unit'" (click)="costMode = 'unit'">Costo por unidad</button>
            </div>
            <label class="field"><span>{{ costMode === 'total' ? 'Cuánto pagaste en total' : 'Cuánto cuesta cada ' + m.ing.unit }}</span><input class="input" type="number" min="0" step="any" [(ngModel)]="cost" placeholder="Opcional"></label>
            @if (unitPreview() !== null) { <p class="tiny muted">Queda a {{ unitPreview() | number: '1.0-2' }} por {{ m.ing.unit }}.</p> }
          }
          <label class="field"><span>Nota</span><input class="input" maxlength="300" [(ngModel)]="note" placeholder="Opcional"></label>
        </div>
        <div class="modal-foot">
          <button class="btn" (click)="move.set(null)">Cancelar</button>
          <button class="btn primary" [disabled]="busy() || qty === null || qty < 0 || (m.type !== 'ADJUST' && !qty)" (click)="saveMove()">Guardar</button>
        </div>
      </div>
    </div>
  }

  @if (hist(); as h) {
    <div class="backdrop" (click)="hist.set(null)">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>Historial · {{ h.name }}</h2><button class="btn icon sm" (click)="hist.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th class="right">Cant.</th><th class="right">Queda</th><th>Detalle</th></tr></thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr>
                  <td class="nowrap muted">{{ r.createdAt | date: 'd MMM, h:mm a' }}</td>
                  <td><span class="badge" [class.green]="r.type === 'ENTRY'" [class.pink]="r.type === 'SALE'" [class.red]="r.type === 'WASTE'" [class.teal]="r.type === 'SALE_VOID'">{{ labels[r.type] }}</span></td>
                  <td class="right num strong">{{ r.quantity > 0 ? '+' : '' }}{{ r.quantity | number: '1.0-3' }}</td>
                  <td class="right num">{{ r.stockAfter | number: '1.0-3' }}</td>
                  <td class="small muted">{{ r.note }}@if (r.unitCost && r.type === 'ENTRY') { · {{ r.unitCost | number: '1.0-2' }} c/u }</td>
                </tr>
              } @empty { <tr><td colspan="5" class="muted">Sin movimientos.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  }`,
  styles: [`
    .filters { margin-bottom: 12px; gap: 12px; }
    td.right .btn + .btn { margin-left: 4px; }
  `],
})
export class IngredientsComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private dialogs = inject(Dialogs);

  items = signal<Ingredient[]>([]);
  q = signal('');
  onlyLow = signal(false);
  busy = signal(false);
  form = signal<IngredientForm | null>(null);
  move = signal<{ ing: Ingredient; type: IngredientMovementType } | null>(null);
  hist = signal<Ingredient | null>(null);
  rows = signal<IngredientMovement[]>([]);
  labels = INGREDIENT_MOVEMENT_LABELS;

  qty: number | null = null;
  cost: number | null = null;
  costMode: 'total' | 'unit' = 'total';
  note = '';

  visible = computed(() => {
    const q = this.q().toLowerCase();
    return this.items().filter(i => (!this.onlyLow() || i.low) && (!q || i.name.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.low) - Number(a.low) || a.name.localeCompare(b.name));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Ingredient[]>('/admin/ingredients').subscribe(i => this.items.set(i));
  }

  openForm(i?: Ingredient): void {
    this.form.set(i ? { id: i.id, name: i.name, unit: i.unit, minStock: i.minStock ?? null } : { name: '', unit: 'ml', minStock: null });
  }

  async saveForm(): Promise<void> {
    const f = this.form();
    if (!f) return;
    this.busy.set(true);
    try {
      const body = { name: f.name.trim(), unit: f.unit.trim(), minStock: f.minStock === null || (f.minStock as unknown) === '' ? null : Number(f.minStock) };
      if (f.id) await this.api.run(this.api.put(`/admin/ingredients/${f.id}`, body));
      else await this.api.run(this.api.post('/admin/ingredients', body));
      this.toasts.ok('Insumo guardado');
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async archive(f: IngredientForm): Promise<void> {
    if (!f.id || !(await this.dialogs.confirm({ title: `¿Archivar «${f.name}»?`, message: 'Se quita de las recetas que lo usan y deja de descontarse al vender.', tone: 'danger', confirm: 'Archivar' }))) return;
    try {
      await this.api.run(this.api.delete(`/admin/ingredients/${f.id}`));
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  openMove(ing: Ingredient, type: IngredientMovementType): void {
    this.qty = null;
    this.cost = null;
    this.costMode = 'total';
    this.note = '';
    this.move.set({ ing, type });
  }

  moveTitle(): string {
    const t = this.move()?.type;
    return t === 'ENTRY' ? 'Entrada' : t === 'WASTE' ? 'Merma' : 'Conteo físico';
  }

  qtyLabel(): string {
    const t = this.move()?.type;
    return t === 'ENTRY' ? 'Cuánto entra' : t === 'WASTE' ? 'Cuánto se perdió' : 'Cuánto contaste';
  }

  unitPreview(): number | null {
    if (!this.cost || !this.qty) return null;
    return this.costMode === 'total' ? Number(this.cost) / Number(this.qty) : Number(this.cost);
  }

  async saveMove(): Promise<void> {
    const m = this.move();
    if (!m) return;
    this.busy.set(true);
    try {
      const hasCost = m.type === 'ENTRY' && !!this.cost;
      await this.api.run(this.api.post(`/admin/ingredients/${m.ing.id}/movements`, {
        type: m.type, quantity: Number(this.qty), note: this.note,
        unitCost: hasCost && this.costMode === 'unit' ? Number(this.cost) : null,
        totalCost: hasCost && this.costMode === 'total' ? Number(this.cost) : null,
      }));
      this.toasts.ok('Movimiento registrado');
      this.move.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  openHistory(i: Ingredient): void {
    this.hist.set(i);
    this.rows.set([]);
    this.api.get<IngredientMovement[]>(`/admin/ingredients/${i.id}/movements`, { limit: 200 }).subscribe(r => this.rows.set(r));
  }
}
