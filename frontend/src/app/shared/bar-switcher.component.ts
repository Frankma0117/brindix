import { Component, ElementRef, HostListener, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, errorMessage } from '../core/api.service';
import { Auth, StaffSession } from '../core/auth.service';
import { PlatformVenue } from '../core/models';
import { IconComponent } from './icon.component';
import { Toasts } from '../core/ui';

/**
 * Selector de bar para el modo soporte: salta de un bar a otro sin pasar por la plataforma.
 * Lista con buscador, estado (activo / suspendido) y teclado (flechas, Enter, Escape).
 */
@Component({
  selector: 'bx-bar-switcher',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="wrap">
      <button type="button" class="trigger" aria-haspopup="listbox" [attr.aria-expanded]="open()" (click)="toggle()" (keydown)="onTriggerKey($event)">
        <span class="av" [style.background]="hue(current())">{{ initials(current()) }}</span>
        <span class="grow"><b class="ellipsis">{{ current() }}</b><small class="muted">Cambiar de bar</small></span>
        <bx-icon name="chevron-down" />
      </button>
      @if (open()) {
        <div class="pop" (keydown)="onKey($event)">
          @if (venues().length > 6) {
            <input #q class="search" placeholder="Buscar bar" aria-label="Buscar bar" [value]="query()" (input)="query.set($any($event.target).value); cursor.set(0)">
          }
          <ul role="listbox" aria-label="Bares" tabindex="-1">
            @for (v of shown(); track v.id; let i = $index) {
              <li role="option" [attr.aria-selected]="v.slug === slug()">
                <button type="button" tabindex="-1" [class.cur]="i === cursor()" [disabled]="!v.active" (mouseenter)="cursor.set(i)" (click)="pick(v)">
                  <span class="av sm" [style.background]="hue(v.name)">{{ initials(v.name) }}</span>
                  <span class="grow"><b class="ellipsis">{{ v.name }}</b><small class="muted">{{ v.active ? '/' + v.slug : 'Suspendido' }}</small></span>
                  @if (v.slug === slug()) { <bx-icon name="check" /> }
                </button>
              </li>
            } @empty { <li class="none muted">Ningún bar coincide.</li> }
          </ul>
        </div>
      }
    </div>`,
  styles: [`
    .wrap { position: relative; }
    .trigger { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--text); text-align: left; transition: border-color 150ms var(--ease-out), background-color 150ms var(--ease-out); }
    @media (hover: hover) and (pointer: fine) { .trigger:hover { border-color: var(--amber); } }
    .trigger:active { transform: scale(.98); }
    .trigger b, .pop b { display: block; font-size: 14px; }
    small { display: block; font-size: 11.5px; }
    .grow { flex: 1; min-width: 0; }
    .av { width: 34px; height: 34px; border-radius: 10px; flex: none; display: grid; place-content: center; color: #fff; font-weight: 800; font-size: 13px; }
    .av.sm { width: 30px; height: 30px; font-size: 12px; }
    .pop { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 60; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 18px 40px rgba(0,0,0,.35); overflow: hidden; transform-origin: top; animation: pop 160ms var(--ease-out) both; }
    .search { width: 100%; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--text); padding: 10px 12px; font: inherit; font-size: 14px; outline: none; }
    ul { list-style: none; margin: 0; padding: 6px; max-height: 260px; overflow-y: auto; }
    li button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border-radius: 10px; border: 0; background: transparent; color: var(--text); text-align: left; }
    li button.cur { background: var(--surface-3, var(--surface)); }
    li button:disabled { opacity: .5; cursor: not-allowed; }
    .none { padding: 14px; text-align: center; font-size: 13px; }
    @keyframes pop { from { opacity: 0; transform: translateY(-4px) scale(.97); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .pop { animation: none; } }
  `],
})
export class BarSwitcherComponent {
  /** Nombre y slug del bar actual. */
  current = input.required<string>();
  slug = input.required<string>();

  private api = inject(Api);
  private auth = inject(Auth);
  private toasts = inject(Toasts);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  open = signal(false);
  query = signal('');
  cursor = signal(0);
  venues = signal<PlatformVenue[]>([]);
  shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.venues().filter(v => `${v.name} ${v.slug}`.toLowerCase().includes(q)) : this.venues();
  });

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
  }
  hue(name: string): string {
    const h = [...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
    return `linear-gradient(135deg, hsl(${h} 70% 50%), hsl(${(h + 40) % 360} 70% 40%))`;
  }

  async toggle(): Promise<void> {
    if (this.open()) { this.open.set(false); return; }
    this.query.set('');
    this.open.set(true);
    try {
      this.venues.set(await firstValueFrom(this.api.get<PlatformVenue[]>('/platform/venues')));
      this.cursor.set(Math.max(0, this.venues().findIndex(v => v.slug === this.slug())));
      setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('.search')?.focus());
    } catch (e) {
      this.open.set(false);
      this.toasts.error(errorMessage(e));
    }
  }

  async pick(v: PlatformVenue): Promise<void> {
    this.open.set(false);
    if (v.slug === this.slug() || !v.active) return;
    try {
      const s = await this.api.run(this.api.post<StaffSession>(`/platform/venues/${v.id}/enter`, {}));
      this.auth.use(s);
      // Carga limpia: ninguna pantalla conserva datos del bar anterior.
      window.location.assign(`/${s.venue}/admin`);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  onTriggerKey(e: KeyboardEvent): void {
    if (!this.open() && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); void this.toggle(); }
  }

  onKey(e: KeyboardEvent): void {
    const n = this.shown().length;
    if (e.key === 'Escape') { e.preventDefault(); this.open.set(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); this.cursor.set(Math.min(n - 1, this.cursor() + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.cursor.set(Math.max(0, this.cursor() - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const v = this.shown()[this.cursor()]; if (v) void this.pick(v); }
  }

  @HostListener('document:mousedown', ['$event'])
  away(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
