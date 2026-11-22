import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { Ingredient, Recipe } from '../../core/models';
import { MoneyPipe, Toasts } from '../../core/ui';
import { IconComponent } from '../../shared/icon.component';

interface RecipeRow { ingredientId: number | null; quantity: number | null; }

/** Receta de un producto: qué insumos gasta cada unidad vendida, con costo y margen. Se guarda por separado del producto. */
@Component({
  selector: 'bx-recipe-editor',
  standalone: true,
  imports: [FormsModule, MoneyPipe, DecimalPipe, IconComponent],
  template: `
  <div class="card flat col recipe">
    <div class="row between"><strong>Receta</strong><span class="tiny muted">Lo que gasta cada unidad vendida</span></div>
    @for (r of rows(); track $index; let i = $index) {
      <div class="rrow">
        <select class="input" [(ngModel)]="r.ingredientId">
          <option [ngValue]="null">Elegir insumo…</option>
          @for (g of ingredients(); track g.id) { <option [ngValue]="g.id">{{ g.name }} ({{ g.unit }})</option> }
        </select>
        <input class="input" type="number" min="0" step="any" [(ngModel)]="r.quantity" placeholder="Cantidad">
        <span class="tiny muted unit">{{ unitOf(r.ingredientId) }}</span>
        <button class="btn icon sm ghost" (click)="remove(i)" aria-label="Quitar insumo"><bx-icon name="x" /></button>
      </div>
    }
    @if (!ingredients().length) { <p class="tiny muted">Primero crea insumos en Insumos y recetas.</p> }
    <div class="row between wrap">
      <button class="btn sm" (click)="add()" [disabled]="!ingredients().length"><bx-icon name="plus" /> Añadir insumo</button>
      <button class="btn sm primary" [disabled]="busy()" (click)="save()">Guardar receta</button>
    </div>
    @if (recipe(); as r) {
      @if (r.lines.length) {
        <p class="tiny">Costo de la receta <strong class="num">{{ r.cost | money }}</strong> · margen
          <strong class="num" [style.color]="r.margin < 0 ? 'var(--c-red)' : 'var(--c-green)'">{{ r.margin | money }}</strong>
          @if (r.marginPct != null) { ({{ r.marginPct | number: '1.0-1' }} %) }</p>
      }
    }
  </div>`,
  styles: [`
    .recipe { margin-top: 4px; }
    .rrow { display: grid; grid-template-columns: 2fr 1fr 44px 42px; gap: 8px; align-items: center; }
    .unit { text-align: left; }
    @media (max-width: 600px) { .rrow { grid-template-columns: 1fr 1fr; } .rrow select { grid-column: 1 / -1; } }
  `],
})
export class RecipeEditorComponent implements OnInit {
  productId = input.required<number>();

  private api = inject(Api);
  private toasts = inject(Toasts);

  ingredients = signal<Ingredient[]>([]);
  rows = signal<RecipeRow[]>([]);
  recipe = signal<Recipe | null>(null);
  busy = signal(false);
  count = computed(() => this.rows().length);

  ngOnInit(): void {
    this.api.get<Ingredient[]>('/admin/ingredients').subscribe(i => this.ingredients.set(i));
    this.api.get<Recipe>(`/admin/products/${this.productId()}/recipe`).subscribe(r => this.apply(r));
  }

  private apply(r: Recipe): void {
    this.recipe.set(r);
    this.rows.set(r.lines.map(l => ({ ingredientId: l.ingredientId, quantity: l.quantity })));
  }

  unitOf(id: number | null): string {
    return this.ingredients().find(g => g.id === id)?.unit ?? '';
  }

  add(): void {
    this.rows.update(r => [...r, { ingredientId: null, quantity: null }]);
  }

  remove(i: number): void {
    this.rows.update(r => r.filter((_, k) => k !== i));
  }

  async save(): Promise<void> {
    const lines = this.rows().filter(r => r.ingredientId && Number(r.quantity) > 0)
      .map(r => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) }));
    this.busy.set(true);
    try {
      this.apply(await this.api.run(this.api.put<Recipe>(`/admin/products/${this.productId()}/recipe`, { lines })));
      this.toasts.ok('Receta guardada');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
