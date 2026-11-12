import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { Banner, Product } from '../../core/models';
import { MoneyPipe, Toasts } from '../../core/ui';

interface BannerForm {
  id?: number; title: string; subtitle: string; imageUrl: string; theme: string; durationSeconds: number;
  sortOrder: number; active: boolean; startsAt: string; endsAt: string; productId: number | null;
}

@Component({
  selector: 'bx-banners',
  standalone: true,
  imports: [FormsModule, MoneyPipe],
  template: `
  <div class="page-head">
    <div><h1>Publicidad</h1><p>Rotan en la pantalla del bar y arriba de la carta del cliente.</p></div>
    <button class="btn primary" (click)="edit()">＋ Nuevo banner</button>
  </div>
  <div class="bgrid">
    @for (b of banners(); track b.id) {
      <div class="bcard" (click)="edit(b)">
        <div class="bprev" [attr.data-theme]="b.theme">
          @if (b.imageUrl) { <img [src]="b.imageUrl" alt=""> }
          <div class="btext"><h3>{{ b.title }}</h3>@if (b.subtitle) { <p>{{ b.subtitle }}</p> }@if (b.productPrice) { <span class="price">{{ b.productPrice | money }}</span> }</div>
        </div>
        <div class="row between meta">
          <span class="badge" [class.green]="b.live" [class.red]="!b.active">{{ b.live ? 'En pantalla' : (b.active ? 'Programado' : 'Apagado') }}</span>
          <span class="tiny muted">{{ b.durationSeconds }} s · orden {{ b.sortOrder }}</span>
        </div>
      </div>
    } @empty { <div class="empty"><h3>Sin publicidad</h3><p>Crea un banner para promociones, eventos o el happy hour.</p></div> }
  </div>

  @if (form(); as f) {
    <div class="backdrop" (click)="form.set(null)">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ f.id ? 'Editar banner' : 'Nuevo banner' }}</h2><button class="btn icon sm" (click)="form.set(null)">✕</button></div>
        <div class="bprev big" [attr.data-theme]="f.theme">@if (f.imageUrl) { <img [src]="f.imageUrl" alt=""> }<div class="btext"><h3>{{ f.title || 'Título' }}</h3><p>{{ f.subtitle }}</p></div></div>
        <div class="form-grid" style="margin-top: 16px">
          <label class="field"><span>Título</span><input class="input" [(ngModel)]="f.title" maxlength="120"></label>
          <label class="field"><span>Texto</span><input class="input" [(ngModel)]="f.subtitle" maxlength="300"></label>
          <div class="field full"><span>Color</span><div class="row wrap">@for (t of themes; track t) { <button class="swatch" [attr.data-theme]="t" [class.on]="f.theme === t" (click)="f.theme = t" [attr.aria-label]="t"></button> }</div></div>
          <div class="field"><span>Imagen (opcional, horizontal)</span>
            <div class="row"><label class="btn sm">{{ uploading() ? 'Subiendo…' : 'Subir imagen' }}<input type="file" accept="image/*" hidden (change)="upload($event)"></label>
              @if (f.imageUrl) { <button class="btn xs ghost" (click)="f.imageUrl = ''">Quitar</button> }</div>
          </div>
          <label class="field"><span>Producto que promociona (muestra el precio)</span>
            <select class="input" [(ngModel)]="f.productId"><option [ngValue]="null">Ninguno</option>@for (p of products(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }</select>
          </label>
          <label class="field"><span>Segundos en pantalla</span><input class="input" type="number" min="3" max="120" [(ngModel)]="f.durationSeconds"></label>
          <label class="field"><span>Orden</span><input class="input" type="number" [(ngModel)]="f.sortOrder"></label>
          <label class="field"><span>Desde (opcional)</span><input class="input" type="datetime-local" [(ngModel)]="f.startsAt"></label>
          <label class="field"><span>Hasta (opcional)</span><input class="input" type="datetime-local" [(ngModel)]="f.endsAt"></label>
          <label class="check full"><input type="checkbox" [(ngModel)]="f.active"> Activo</label>
        </div>
        <div class="modal-foot">
          @if (f.id) { <button class="btn danger" style="margin-right: auto" (click)="remove()">Eliminar</button> }
          <button class="btn" (click)="form.set(null)">Cancelar</button>
          <button class="btn primary" [disabled]="!f.title.trim()" (click)="save()">Guardar</button>
        </div>
      </div>
    </div>
  }`,
  styles: [`
    .bgrid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .bcard { cursor: pointer; display: flex; flex-direction: column; gap: 8px; }
    .bprev { position: relative; aspect-ratio: 16 / 8; border-radius: 16px; overflow: hidden; padding: 16px; display: flex; align-items: flex-end; background: linear-gradient(135deg, var(--p1), var(--p2)); }
    .bprev.big { aspect-ratio: 16 / 6; }
    .bprev img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .6; }
    .btext { position: relative; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.3); }
    .btext h3 { font-size: 22px; font-weight: 800; }
    .price { display: inline-block; margin-top: 6px; background: #fff; color: #120f1b; padding: 2px 10px; border-radius: 99px; font-weight: 800; }
    .meta { padding: 0 4px; }
    .swatch { width: 40px; height: 40px; border-radius: 12px; border: 2px solid transparent; background: linear-gradient(135deg, var(--p1), var(--p2)); cursor: pointer; }
    .swatch.on { border-color: #fff; }
    [data-theme=amber] { --p1: #ffb238; --p2: #e2521d; }
    [data-theme=neon] { --p1: #ff4f8b; --p2: #6d28d9; }
    [data-theme=lime] { --p1: #84cc16; --p2: #0f766e; }
    [data-theme=berry] { --p1: #be185d; --p2: #4c1d95; }
    [data-theme=ocean] { --p1: #06b6d4; --p2: #1e3a8a; }
  `],
})
export class BannersComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  banners = signal<Banner[]>([]);
  products = signal<Product[]>([]);
  form = signal<BannerForm | null>(null);
  uploading = signal(false);
  themes = ['amber', 'neon', 'lime', 'berry', 'ocean'];

  ngOnInit(): void {
    this.load();
    this.api.get<Product[]>('/admin/products').subscribe(p => this.products.set(p));
  }

  load(): void {
    this.api.get<Banner[]>('/admin/banners').subscribe(b => this.banners.set(b));
  }

  edit(b?: Banner): void {
    this.form.set(b ? {
      id: b.id, title: b.title, subtitle: b.subtitle ?? '', imageUrl: b.imageUrl ?? '', theme: b.theme, durationSeconds: b.durationSeconds,
      sortOrder: b.sortOrder, active: b.active, startsAt: toLocal(b.startsAt), endsAt: toLocal(b.endsAt), productId: b.productId ?? null,
    } : { title: '', subtitle: '', imageUrl: '', theme: 'neon', durationSeconds: 10, sortOrder: this.banners().length + 1, active: true, startsAt: '', endsAt: '', productId: null });
  }

  async upload(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const { url } = await this.api.upload(file, 'banners');
      this.form.update(f => f && { ...f, imageUrl: url });
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.uploading.set(false);
    }
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    const body = { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null };
    try {
      if (f.id) await this.api.run(this.api.put(`/admin/banners/${f.id}`, body));
      else await this.api.run(this.api.post('/admin/banners', body));
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async remove(): Promise<void> {
    const f = this.form();
    if (!f?.id || !confirm('¿Eliminar este banner?')) return;
    await this.api.run(this.api.delete(`/admin/banners/${f.id}`));
    this.form.set(null);
    this.load();
  }
}

function toLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
