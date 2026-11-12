import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Api, errorMessage } from '../../core/api.service';
import { ART_OPTIONS, Category, Product } from '../../core/models';
import { MoneyPipe, Toasts } from '../../core/ui';
import { ProductArtComponent } from '../../shared/product-art.component';
import { IconComponent } from '../../shared/icon.component';

interface ProductForm {
  id?: number; categoryId: number | null; name: string; description: string; price: number | null; cost: number | null;
  imageUrl: string; unit: string; trackStock: boolean; minStock: number; available: boolean; featured: boolean;
  tags: string; initialStock: number | null;
}
interface CategoryForm { id?: number; name: string; icon: string; art: string; active: boolean; sortOrder: number; }
interface Section { category: Category; products: Product[]; }

/**
 * Carta del administrador: categorías como secciones, productos arrastrables (también entre
 * categorías), precio y costo editables en la fila, y fotos que se suben tocando o soltando el archivo.
 */
@Component({
  selector: 'bx-menu-editor',
  standalone: true,
  imports: [IconComponent, FormsModule, MoneyPipe, ProductArtComponent, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './menu-editor.component.html',
  styleUrl: './menu-editor.component.scss',
})
export class MenuEditorComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);

  sections = signal<Section[]>([]);
  q = signal('');
  form = signal<ProductForm | null>(null);
  catForm = signal<CategoryForm | null>(null);
  saving = signal(false);
  uploading = signal<number | 'form' | null>(null);
  describing = signal(false);
  dragOver = signal<number | null>(null);
  aiEnabled = signal(false);
  arts = ART_OPTIONS;

  totalProducts = computed(() => this.sections().reduce((a, s) => a + s.products.length, 0));
  stats = computed(() => {
    const all = this.sections().flatMap(s => s.products);
    const withCost = all.filter(p => p.cost != null);
    const avg = withCost.length ? withCost.reduce((a, p) => a + (p.marginPct ?? 0), 0) / withCost.length : 0;
    return { total: all.length, noPhoto: all.filter(p => !p.imageUrl).length, noCost: all.length - withCost.length, avgMargin: Math.round(avg) };
  });

  ngOnInit(): void {
    this.load();
    this.api.get<{ integrations: { aiEnabled: boolean } }>('/admin/venue').subscribe(v => this.aiEnabled.set(v.integrations.aiEnabled));
  }

  load(): void {
    this.api.get<Category[]>('/admin/categories').subscribe(cats => {
      this.api.get<Product[]>('/admin/products').subscribe(products => {
        this.sections.set(cats.map(c => ({ category: c, products: products.filter(p => p.categoryId === c.id).sort((a, b) => a.sortOrder - b.sortOrder) })));
      });
    });
  }

  matches(p: Product): boolean {
    const q = this.q().trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  }

  listIds(): string[] {
    return this.sections().map(s => 'cat-' + s.category.id);
  }

  // ---------- Arrastrar ----------

  async dropCategory(e: CdkDragDrop<Section[]>): Promise<void> {
    const list = [...this.sections()];
    moveItemInArray(list, e.previousIndex, e.currentIndex);
    this.sections.set(list);
    try {
      await this.api.run(this.api.put('/admin/categories/order', { ids: list.map(s => s.category.id) }));
    } catch (err) {
      this.toasts.error(errorMessage(err));
      this.load();
    }
  }

  async dropProduct(e: CdkDragDrop<Product[]>, target: Section): Promise<void> {
    if (e.previousContainer === e.container) {
      moveItemInArray(e.container.data, e.previousIndex, e.currentIndex);
    } else {
      transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex);
    }
    this.sections.update(s => [...s]);
    try {
      await this.api.run(this.api.put('/admin/products/order', { categoryId: target.category.id, ids: e.container.data.map(p => p.id) }));
      if (e.previousContainer !== e.container) this.toasts.ok('Producto movido a ' + target.category.name);
    } catch (err) {
      this.toasts.error(errorMessage(err));
      this.load();
    }
  }

  // ---------- Edición en la fila ----------

  async patch(p: Product, change: Partial<{ price: number; cost: number; available: boolean; featured: boolean; imageUrl: string; clearImage: boolean }>): Promise<void> {
    try {
      const updated = await this.api.run(this.api.patch<Product>(`/admin/products/${p.id}`, change));
      this.sections.update(list => list.map(s => ({ ...s, products: s.products.map(x => x.id === p.id ? updated : x) })));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  savePrice(p: Product, field: 'price' | 'cost', value: string): void {
    const n = Number(value);
    if (value === '' || Number.isNaN(n) || n < 0 || n === (p[field] ?? null)) return;
    this.patch(p, { [field]: n });
  }

  // ---------- Fotos ----------

  async uploadFor(p: Product, file: File | undefined): Promise<void> {
    if (!file) return;
    this.uploading.set(p.id);
    try {
      const { url } = await this.api.upload(file, 'products');
      await this.patch(p, { imageUrl: url });
      this.toasts.ok('Foto actualizada');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.uploading.set(null);
    }
  }

  onFile(p: Product, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.uploadFor(p, input.files?.[0]);
    input.value = '';
  }

  onDrop(p: Product, ev: DragEvent): void {
    ev.preventDefault();
    this.dragOver.set(null);
    this.uploadFor(p, ev.dataTransfer?.files?.[0]);
  }

  onDragOver(p: Product, ev: DragEvent): void {
    if (ev.dataTransfer?.types?.includes('Files')) {
      ev.preventDefault();
      this.dragOver.set(p.id);
    }
  }

  async uploadForm(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set('form');
    try {
      const { url } = await this.api.upload(file, 'products');
      this.form.update(f => f && { ...f, imageUrl: url });
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.uploading.set(null);
      input.value = '';
    }
  }

  // ---------- Formulario completo ----------

  newProduct(categoryId?: number): void {
    this.form.set({
      categoryId: categoryId ?? this.sections()[0]?.category.id ?? null, name: '', description: '', price: null, cost: null,
      imageUrl: '', unit: 'und', trackStock: true, minStock: 5, available: true, featured: false, tags: '', initialStock: null,
    });
  }

  edit(p: Product): void {
    this.form.set({
      id: p.id, categoryId: p.categoryId, name: p.name, description: p.description ?? '', price: p.price, cost: p.cost ?? null,
      imageUrl: p.imageUrl ?? '', unit: p.unit, trackStock: p.trackStock, minStock: p.minStock, available: p.available,
      featured: p.featured, tags: p.tags ?? '', initialStock: null,
    });
  }

  formProfit(f: ProductForm): string {
    if (f.price == null || f.cost == null || (f.cost as unknown) === '') return '';
    const profit = Number(f.price) - Number(f.cost);
    const pct = Number(f.price) ? Math.round((profit / Number(f.price)) * 100) : 0;
    return `Ganas ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(profit)} por unidad (${pct} %)`;
  }

  categoryName(id: number | null): string {
    return this.sections().find(s => s.category.id === id)?.category.name ?? '';
  }

  artOf(id: number | null): string | undefined {
    return this.sections().find(s => s.category.id === id)?.category.art;
  }

  async describe(): Promise<void> {
    const f = this.form();
    if (!f?.name.trim()) { this.toasts.error('Escribe primero el nombre'); return; }
    this.describing.set(true);
    try {
      const r = await this.api.run(this.api.post<{ description: string }>('/admin/ai/describe', {
        name: f.name, category: this.categoryName(f.categoryId), hints: f.description,
      }));
      this.form.update(x => x && { ...x, description: r.description });
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.describing.set(false);
    }
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    this.saving.set(true);
    try {
      const body = { ...f, price: Number(f.price), cost: f.cost === null || (f.cost as unknown) === '' ? null : Number(f.cost) };
      if (f.id) await this.api.run(this.api.put(`/admin/products/${f.id}`, body));
      else await this.api.run(this.api.post('/admin/products', body));
      this.toasts.ok('Producto guardado');
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async archive(): Promise<void> {
    const f = this.form();
    if (!f?.id || !confirm(`¿Quitar «${f.name}» de la carta? Se conserva en el historial de ventas.`)) return;
    try {
      await this.api.run(this.api.delete(`/admin/products/${f.id}`));
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  // ---------- Categorías ----------

  editCat(c?: Category): void {
    this.catForm.set(c ? { id: c.id, name: c.name, icon: c.icon ?? '', art: c.art ?? 'food', active: c.active, sortOrder: c.sortOrder }
      : { name: '', icon: '', art: 'cocktail', active: true, sortOrder: 0 });
  }

  async saveCat(): Promise<void> {
    const f = this.catForm();
    if (!f) return;
    try {
      if (f.id) await this.api.run(this.api.put(`/admin/categories/${f.id}`, f));
      else await this.api.run(this.api.post('/admin/categories', f));
      this.catForm.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async deleteCat(): Promise<void> {
    const f = this.catForm();
    if (!f?.id || !confirm(`¿Eliminar la categoría «${f.name}»?`)) return;
    try {
      await this.api.run(this.api.delete(`/admin/categories/${f.id}`));
      this.catForm.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  setForm<K extends keyof ProductForm>(key: K, value: ProductForm[K]): void {
    this.form.update(f => f && { ...f, [key]: value });
  }
}
