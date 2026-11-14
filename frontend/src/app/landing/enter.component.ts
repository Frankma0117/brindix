import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Api, errorMessage } from '../core/api.service';
import { Auth, LAST_VENUE_KEY, LastVenue } from '../core/auth.service';
import { ThemeToggleComponent } from '../core/theme';
import { store } from '../core/ui';
import { IconComponent } from '../shared/icon.component';
import { MascotComponent } from '../shared/mascot.component';

interface VenueHit { slug: string; name: string; logoUrl?: string; }

/** Ingreso en un solo paso: el bar (por su dirección exacta, sin listados; se recuerda), usuario y contraseña. */
@Component({
  selector: 'bx-enter',
  standalone: true,
  imports: [FormsModule, RouterLink, ThemeToggleComponent, IconComponent, MascotComponent],
  template: `
  <bx-theme-toggle class="theme-corner" />
  <main class="wrap">
    <form class="card pad-lg box" (ngSubmit)="submit()" autocomplete="on">
      <a routerLink="/" class="brand"><bx-mascot [size]="34" [animate]="false" /> Brindix</a>
      <h1>Ingresar</h1>

      <div class="field">
        <span>Dirección de tu bar</span>
        @if (venue(); as v) {
          <div class="picked">
            @if (v.logoUrl) { <img [src]="v.logoUrl" alt=""> } @else { <bx-icon name="store" /> }
            <b class="grow ellipsis">{{ v.name }}</b>
            <button type="button" class="btn ghost xs" (click)="changeVenue()">Cambiar</button>
          </div>
        } @else {
          <div class="search-box">
            <input class="input" name="bar" [ngModel]="query()" (ngModelChange)="onQuery($event)" placeholder="Dirección de tu bar, ej. mi-bar"
                   autocomplete="off" autocapitalize="none" (keydown.enter)="$event.preventDefault(); pickFirst()" role="combobox" [attr.aria-expanded]="hits().length > 0">
            @if (hits().length) {
              <ul class="hits" role="listbox">
                @for (h of hits(); track h.slug) {
                  <li><button type="button" role="option" (click)="pick(h)">
                    @if (h.logoUrl) { <img [src]="h.logoUrl" alt=""> } @else { <bx-icon name="store" /> }
                    <span class="grow"><b>{{ h.name }}</b><small>brindix.cania.app/{{ h.slug }}</small></span>
                  </button></li>
                }
              </ul>
            } @else if (query().trim().length >= 2 && searched()) {
              <p class="tiny muted none">No encontramos esa dirección. Escríbela completa, como aparece en brindix.cania.app/…, o pídesela al administrador.</p>
            }
          </div>
        }
      </div>

      <label class="field"><span>Usuario</span>
        <input class="input" name="u" [(ngModel)]="username" autocomplete="username" autocapitalize="none" required>
      </label>
      <label class="field"><span>Contraseña</span>
        <input class="input" name="p" type="password" [(ngModel)]="password" autocomplete="current-password" required>
      </label>
      @if (error()) { <p class="err">{{ error() }}</p> }
      <button class="btn primary lg block" [disabled]="busy() || !venue() || !username.trim() || !password">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
      <div class="links">
        @if (venue()) { <a [routerLink]="'/' + venue()!.slug + '/recuperar'">¿Olvidaste tu contraseña?</a> }
        <a routerLink="/plataforma">Administración de Brindix</a>
      </div>
    </form>
  </main>`,
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .box { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 16px; }
    .brand { display: inline-flex; align-items: center; gap: 8px; color: var(--text); font-weight: 800; font-size: 17px; }
    h1 { font-size: 26px; }
    .picked { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 6px 0 10px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); }
    .picked img, .hits img { width: 30px; height: 30px; border-radius: 9px; object-fit: cover; flex: none; }
    .picked bx-icon, .hits bx-icon { color: var(--muted); --icon-size: 20px; }
    .search-box { position: relative; }
    .hits { position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 6px); list-style: none; margin: 0; padding: 6px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line-2); box-shadow: var(--shadow-lg); }
    .hits button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 8px; border: 0; border-radius: 10px; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
    @media (hover: hover) and (pointer: fine) { .hits button:hover { background: var(--surface-2); } }
    .hits b { display: block; font-size: 14.5px; }
    .hits small { color: var(--faint); font-size: 12px; }
    .none { margin-top: 6px; }
    .err { color: var(--ink-red); font-weight: 600; font-size: 14px; }
    .links { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13.5px; }
    .links a { color: var(--muted); padding: 6px 0; }
  `],
})
export class EnterComponent {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  venue = signal<LastVenue | null>(store.get<LastVenue | null>(LAST_VENUE_KEY, null));
  query = signal('');
  hits = signal<VenueHit[]>([]);
  searched = signal(false);
  username = '';
  password = '';
  busy = signal(false);
  error = signal('');
  private q$ = new Subject<string>();

  constructor() {
    if (this.auth.session()) this.router.navigateByUrl(this.auth.home());
    this.q$.pipe(
      debounceTime(220), distinctUntilChanged(),
      switchMap(q => q.trim().length < 2 ? of([]) : this.api.get<VenueHit[]>(`/public/venues?q=${encodeURIComponent(q.trim())}`).pipe(catchError(() => of([])))),
      takeUntilDestroyed(),
    ).subscribe(h => { this.hits.set(h); this.searched.set(true); });
  }

  onQuery(q: string): void {
    this.query.set(q);
    this.searched.set(false);
    this.q$.next(q);
  }

  pick(h: VenueHit): void {
    this.venue.set({ slug: h.slug, name: h.name, logoUrl: h.logoUrl });
    this.hits.set([]);
    this.error.set('');
  }

  pickFirst(): void {
    if (this.hits().length) this.pick(this.hits()[0]);
  }

  changeVenue(): void {
    this.venue.set(null);
    this.query.set('');
    this.hits.set([]);
  }

  async submit(): Promise<void> {
    const v = this.venue();
    if (!v) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(v.slug, this.username.trim(), this.password);
      store.set(LAST_VENUE_KEY, v);
      this.router.navigateByUrl(this.auth.home());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
