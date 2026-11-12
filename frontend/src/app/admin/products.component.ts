import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api.service';
import { ART_OPTIONS, Category, Product } from '../core/models';
import { MoneyPipe, Toasts } from '../core/ui';
import { ProductArtComponent } from '../shared/product-art.component';

interface ProductForm {
  id?: number; categoryId: number | null; name: string; description: string; price: number | null; cost: number | null;
  imageUrl: string; unit: string; trackStock: boolean; minStock: number; available: boolean; featured: boolean;
  tags: string; sortOrder: number; initialStock: number | null;
}
interface CategoryForm { id?: number; name: string; icon: string; art: string; sortOrder: number; active: boolean; }

@Component({
  selector: 'bx-products',
  standalone: true,
  imports: [FormsModule, MoneyPipe, ProductArtComponent],
  templateUrl: './products.component.html',
  styles: [`
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .toolbar .search { flex: 1; min-width: 220px; }
    .cats { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 16px; scrollbar-width: none; }
    .plist { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .p { display: flex; gap: 12px; padding: 12px; align-items: center; cursor: pointer; }
    .p:hover { border-color: var(--line-2); }
    .p.off { opacity: .55; }
    .thumb { width: 72px; height: 72px; border-radius: 14px; flex: none; }
    .price { color: var(--amber); font-weight: 800; }
    .preview { width: 100%; height: 170px; border-radius: 16px; }
    .art-pick { display: flex; gap: 6px; flex-wrap: wrap; }
    .catrow { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .file { display: none; }
  `],
})
export class ProductsComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  cat = signal<number | null>(null);
  q = signal('');
  form = signal<ProductForm | null>(null);
  catForm = signal<CategoryForm | null>(null);
  showCats = signal(false);
  saving = signal(false);
  uploading = signal(false);
  arts = ART_OPTIONS;

  visible = computed(() => {
    const q = this.q().toLowerCase();
    return this.products().filter(p => (this.cat() === null || p.categoryId === this.cat()) && (!q || p.name.toLowerCase().includes(q)));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Product[]>('/staff/products').subscribe(p => this.products.set(p));
    this.api.get<Category[]>('/staff/categories').subscribe(c => this.categories.set(c));
  }

  artOf(categoryId: number | null): string | undefined {
    return this.categories().find(c => c.id === categoryId)?.art;
  }

  newProduct(): void {
    this.form.set({
      categoryId: this.cat() ?? this.categories()[0]?.id ?? null, name: '', description: '', price: null, cost: null,
      imageUrl: '', unit: 'und', trackStock: true, minStock: 5, available: true, featured: false, tags: '', sortOrder: 0, initialStock: null,
    });
  }

  edit(p: Product): void {
    this.form.set({
      id: p.id, categoryId: p.categoryId, name: p.name, description: p.description ?? '', price: p.price, cost: p.cost ?? null,
      imageUrl: p.imageUrl ?? '', unit: p.unit, trackStock: p.trackStock, minStock: p.minStock, available: p.available,
      featured: p.featured, tags: p.tags ?? '', sortOrder: p.sortOrder, initialStock: null,
    });
  }

  async upload(ev: Event, target: 'product'): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const { url } = await this.api.upload(file);
      if (target === 'product') this.form.update(f => f && { ...f, imageUrl: url });
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.uploading.set(false);
      (ev.target as HTMLInputElement).value = '';
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

  async toggle(p: Product, ev: Event): Promise<void> {
    ev.stopPropagation();
    try {
      await this.api.run(this.api.patch(`/staff/products/${p.id}/available`, { available: !p.available }));
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async archive(): Promise<void> {
    const f = this.form();
    if (!f?.id || !confirm(`¿Quitar «${f.name}» de la carta? Se conserva en el historial.`)) return;
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
    this.catForm.set(c ? { id: c.id, name: c.name, icon: c.icon ?? '', art: c.art ?? 'food', sortOrder: c.sortOrder, active: c.active }
      : { name: '', icon: '🍹', art: 'cocktail', sortOrder: this.categories().length + 1, active: true });
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

  patch<K extends keyof ProductForm>(key: K, value: ProductForm[K]): void {
    this.form.update(f => f && { ...f, [key]: value });
  }
}
