import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Api, errorMessage } from '../core/api.service';
import { Banner, MenuCategory, MenuProduct, PublicTab, PublicVenue, Queue, RoundStatus, Track } from '../core/models';
import { AgoPipe, MoneyPipe, Toasts, duration, store } from '../core/ui';
import { MascotComponent } from '../shared/mascot.component';
import { ProductArtComponent } from '../shared/product-art.component';

interface CartLine { product: MenuProduct; quantity: number; note?: string; }
type View = 'menu' | 'music' | 'tab';

@Component({
  selector: 'bx-table-menu',
  standalone: true,
  imports: [FormsModule, RouterLink, MoneyPipe, AgoPipe, MascotComponent, ProductArtComponent],
  templateUrl: './table-menu.component.html',
  styleUrl: './table-menu.component.scss',
})
export class TableMenuComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private destroyRef = inject(DestroyRef);

  /** Código del QR (ruta /m/:code). Sin código la carta es solo para mirar. */
  code = input<string>();

  view = signal<View>('menu');
  venue = signal<PublicVenue | null>(null);
  menu = signal<MenuCategory[]>([]);
  banners = signal<Banner[]>([]);
  tab = signal<PublicTab | null>(null);
  queue = signal<Queue | null>(null);
  loading = signal(true);
  tableError = signal('');
  activeCategory = signal<number | null>(null);
  query = signal('');
  bannerIndex = signal(0);

  detail = signal<MenuProduct | null>(null);
  detailQty = signal(1);
  detailNote = '';
  cartOpen = signal(false);
  cart = signal<CartLine[]>([]);
  clientName = store.get<string>('brindix.name', '');
  orderNote = '';
  sending = signal(false);
  sent = signal(false);

  songQuery = '';
  private songSearch$ = new Subject<string>();
  tracks = signal<Track[]>([]);
  searching = signal(false);
  manualTitle = '';
  manualArtist = '';
  requesting = signal<string | null>(null);

  duration = duration;
  Math = Math;
  canOrder = computed(() => !!this.code() && !this.tableError() && (this.venue()?.clientOrdersEnabled ?? false));
  cartCount = computed(() => this.cart().reduce((a, l) => a + l.quantity, 0));
  cartTotal = computed(() => this.cart().reduce((a, l) => a + l.quantity * l.product.price, 0));
  featured = computed(() => this.menu().flatMap(c => c.products).filter(p => p.featured && !p.soldOut));
  filtered = computed(() => {
    const q = this.norm(this.query());
    const cats = this.menu();
    if (!q) return cats;
    return cats.map(c => ({ ...c, products: c.products.filter(p => this.norm(p.name + ' ' + (p.description ?? '') + ' ' + p.tags.join(' ')).includes(q)) }))
      .filter(c => c.products.length);
  });

  ngOnInit(): void {
    const code = this.code();
    this.api.get<PublicVenue>('/public/venue').subscribe(v => this.venue.set(v));
    this.api.get<Banner[]>('/public/banners').subscribe(b => this.banners.set(b));
    this.api.get<MenuCategory[]>('/public/menu').subscribe({
      next: m => {
        this.menu.set(m);
        this.loading.set(false);
        this.restoreCart(m);
      },
      error: () => this.loading.set(false),
    });
    if (code) this.refreshTab();

    // Banners en carrusel.
    timer(6000, 6000).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.banners().length > 1 && this.bannerIndex.update(i => (i + 1) % this.banners().length));
    // La cuenta y la música se refrescan solas mientras están a la vista.
    timer(10000, 10000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.view() === 'tab' && code) this.refreshTab();
      if (this.view() === 'music') this.refreshQueue();
    });
    this.songSearch$.pipe(
      debounceTime(350), distinctUntilChanged(),
      switchMap(q => {
        if (q.trim().length < 2) { this.searching.set(false); return of([] as Track[]); }
        this.searching.set(true);
        return this.api.get<Track[]>('/public/music/search', { q }).pipe(catchError(() => of([] as Track[])));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(t => { this.tracks.set(t); this.searching.set(false); });
  }

  setView(v: View): void {
    this.view.set(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (v === 'music') this.refreshQueue();
    if (v === 'tab') this.refreshTab();
  }

  scrollTo(id: number | null): void {
    this.activeCategory.set(id);
    const el = id === null ? document.getElementById('top') : document.getElementById('cat-' + id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Pedido ----------

  openDetail(p: MenuProduct): void {
    this.detail.set(p);
    this.detailQty.set(1);
    this.detailNote = '';
  }

  addToCart(p: MenuProduct, qty = 1, note?: string): void {
    if (p.soldOut) return;
    this.cart.update(lines => {
      const n = (note ?? '').trim() || undefined;
      const i = lines.findIndex(l => l.product.id === p.id && l.note === n);
      if (i >= 0) return lines.map((l, k) => k === i ? { ...l, quantity: Math.min(20, l.quantity + qty) } : l);
      return [...lines, { product: p, quantity: qty, note: n }];
    });
    this.saveCart();
    this.detail.set(null);
    this.toasts.show(`${qty} × ${p.name} al pedido`, 'ok', 1800);
  }

  changeQty(line: CartLine, delta: number): void {
    this.cart.update(lines => lines.map(l => l === line ? { ...l, quantity: l.quantity + delta } : l).filter(l => l.quantity > 0));
    this.saveCart();
    if (!this.cart().length) this.cartOpen.set(false);
  }

  qtyInCart(id: number): number {
    return this.cart().filter(l => l.product.id === id).reduce((a, l) => a + l.quantity, 0);
  }

  async sendOrder(): Promise<void> {
    if (!this.code() || !this.cart().length) return;
    this.sending.set(true);
    store.set('brindix.name', this.clientName.trim());
    try {
      const tab = await this.api.run(this.api.post<PublicTab>(`/public/tables/${this.code()}/orders`, {
        clientName: this.clientName.trim() || null,
        note: this.orderNote.trim() || null,
        items: this.cart().map(l => ({ productId: l.product.id, quantity: l.quantity, note: l.note ?? null })),
      }));
      this.tab.set(tab);
      this.cart.set([]);
      this.saveCart();
      this.orderNote = '';
      this.sent.set(true);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  closeSent(): void {
    this.sent.set(false);
    this.cartOpen.set(false);
    this.setView('tab');
  }

  async callWaiter(type: 'WAITER' | 'BILL'): Promise<void> {
    try {
      this.tab.set(await this.api.run(this.api.post<PublicTab>(`/public/tables/${this.code()}/call?type=${type}`)));
      this.toasts.ok(type === 'BILL' ? 'Listo, ya te traen la cuenta' : 'Listo, el mesero viene en camino');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  statusLabel(s: RoundStatus): string {
    return { PENDING: 'Esperando al mesero', CONFIRMED: 'Confirmado', DELIVERED: 'Entregado', REJECTED: 'No disponible' }[s];
  }

  // ---------- Música ----------

  onSongQuery(q: string): void {
    this.songQuery = q;
    this.songSearch$.next(q);
  }

  async requestTrack(t: Track): Promise<void> {
    await this.request({ title: t.title, artist: t.artist, spotifyUri: t.uri, albumImage: t.image, durationMs: t.durationMs }, t.uri);
  }

  async requestManual(): Promise<void> {
    if (!this.manualTitle.trim()) return;
    await this.request({ title: this.manualTitle.trim(), artist: this.manualArtist.trim() || null }, 'manual');
    this.manualTitle = '';
    this.manualArtist = '';
  }

  private async request(body: Record<string, unknown>, key: string): Promise<void> {
    if (!this.code()) {
      this.toasts.error('Escanea el QR de tu mesa para pedir canciones');
      return;
    }
    this.requesting.set(key);
    store.set('brindix.name', this.clientName.trim());
    try {
      await this.api.run(this.api.post(`/public/tables/${this.code()}/songs`, { ...body, requestedBy: this.clientName.trim() || null }));
      this.toasts.ok('¡Listo! Tu canción quedó pedida 🎶');
      this.songQuery = '';
      this.tracks.set([]);
      this.refreshQueue();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.requesting.set(null);
    }
  }

  // ---------- Internos ----------

  private refreshTab(): void {
    const code = this.code();
    if (!code) return;
    this.api.get<PublicTab>(`/public/tables/${code}/tab`).subscribe({
      next: t => { this.tab.set(t); this.tableError.set(''); },
      error: e => this.tableError.set(errorMessage(e)),
    });
  }

  private refreshQueue(): void {
    this.api.get<Queue>('/public/music/queue').subscribe({ next: q => this.queue.set(q), error: () => {} });
  }

  private cartKey(): string {
    return 'brindix.cart.' + (this.code() ?? 'carta');
  }

  private saveCart(): void {
    store.set(this.cartKey(), this.cart().map(l => ({ id: l.product.id, quantity: l.quantity, note: l.note })));
  }

  /** Recupera el pedido sin enviar si el cliente recarga la página. */
  private restoreCart(menu: MenuCategory[]): void {
    const saved = store.get<{ id: number; quantity: number; note?: string }[]>(this.cartKey(), []);
    const byId = new Map(menu.flatMap(c => c.products).map(p => [p.id, p]));
    this.cart.set(saved.map(s => ({ product: byId.get(s.id)!, quantity: s.quantity, note: s.note }))
      .filter(l => l.product && !l.product.soldOut));
  }

  private norm(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }
}
