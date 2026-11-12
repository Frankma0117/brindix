import { Component, Injectable, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { Api, errorMessage } from './api.service';
import { PublicVenue } from './models';
import { MascotComponent } from '../shared/mascot.component';

/** El bar en el que se está navegando (/:slug/...). */
@Injectable({ providedIn: 'root' })
export class VenueContext {
  private api = inject(Api);
  readonly slug = signal('');
  readonly venue = signal<PublicVenue | null>(null);
  readonly error = signal('');
  readonly name = computed(() => this.venue()?.name ?? '');

  load(slug: string): void {
    if (this.slug() === slug && this.venue()) return;
    this.slug.set(slug);
    this.venue.set(null);
    this.error.set('');
    this.api.get<PublicVenue>(`/public/${slug}/venue`).subscribe({
      next: v => this.venue.set(v),
      error: e => this.error.set(errorMessage(e)),
    });
  }

  /** Ruta pública de la API de este bar. */
  pub(path: string): string {
    return `/public/${this.slug()}${path}`;
  }
}

/** Contenedor de todas las páginas de un bar: carga el bar o muestra que no existe. */
@Component({
  selector: 'bx-venue-shell',
  standalone: true,
  imports: [RouterOutlet, MascotComponent],
  template: `
    @if (ctx.error()) {
      <main class="nf">
        <bx-mascot [size]="120" mood="wink" />
        <h1>Este bar no está en Brindix</h1>
        <p class="muted">{{ ctx.error() }}</p>
        <a class="btn primary" href="/">Ir a Brindix</a>
      </main>
    } @else {
      <router-outlet />
    }`,
  styles: [`.nf { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: 12px; text-align: center; padding: 16px; }`],
})
export class VenueShellComponent {
  ctx = inject(VenueContext);
  slug = input.required<string>();

  constructor() {
    // Se carga ya (antes que las páginas hijas) y otra vez si cambia la dirección.
    this.ctx.load(inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '');
    effect(() => this.ctx.load(this.slug()));
  }
}
