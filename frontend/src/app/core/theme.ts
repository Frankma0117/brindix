import { Component, Injectable, computed, inject, input, signal } from '@angular/core';
import { store } from './ui';

export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'brindix.theme';
const META: Record<'light' | 'dark', string> = { light: '#faf7f2', dark: '#0c0a12' };

/**
 * Modo claro / oscuro. "auto" sigue al celular o computador. La elección se guarda en este
 * navegador; el modo resuelto queda en <html data-mode="light|dark"> (index.html lo aplica
 * antes de cargar Angular para que no parpadee).
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  private media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  private systemLight = signal(!!this.media?.matches);

  readonly choice = signal<ThemeChoice>(store.get<ThemeChoice>(KEY, 'auto'));
  readonly mode = computed<'light' | 'dark'>(() => {
    const c = this.choice();
    return c === 'auto' ? (this.systemLight() ? 'light' : 'dark') : c;
  });

  constructor() {
    this.media?.addEventListener?.('change', e => { this.systemLight.set(e.matches); this.apply(); });
    this.apply();
  }

  /** Automático → Claro → Oscuro → Automático. */
  cycle(): void {
    const next: ThemeChoice = this.choice() === 'auto' ? 'light' : this.choice() === 'light' ? 'dark' : 'auto';
    this.choice.set(next);
    store.set(KEY, next);
    this.apply();
  }

  private apply(): void {
    const mode = this.mode();
    document.documentElement.dataset['mode'] = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[mode]);
  }
}

/** Botón que cambia entre automático, claro y oscuro. */
@Component({
  selector: 'bx-theme-toggle',
  standalone: true,
  template: `
    <button type="button" class="btn icon" [class.sm]="small()" (click)="theme.cycle()" [title]="label()" [attr.aria-label]="label()">
      {{ icon() }}
    </button>`,
})
export class ThemeToggleComponent {
  theme = inject(Theme);
  small = input(true);
  icon = computed(() => ({ auto: '🌓', light: '☀️', dark: '🌙' })[this.theme.choice()]);
  label = computed(() => ({ auto: 'Tema: automático (toca para claro)', light: 'Tema: claro (toca para oscuro)', dark: 'Tema: oscuro (toca para automático)' })[this.theme.choice()]);
}
