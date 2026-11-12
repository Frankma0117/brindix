import { Component, ElementRef, Injectable, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { IconName } from './icons';

/** Campo opcional del diálogo (motivo, cantidad, nombre…). */
export interface DialogInput {
  label: string;
  value?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'password';
  /** Obliga a escribir algo (o un mínimo de caracteres) antes de confirmar. */
  required?: boolean;
  minLength?: number;
  min?: number;
  max?: number;
  hint?: string;
}

export interface DialogOptions {
  title: string;
  message?: string;
  /** Texto del botón principal: un verbo con su objeto («Rechazar solicitud»). */
  confirm?: string;
  cancel?: string;
  /** danger = la acción no se puede deshacer o quita algo. */
  tone?: 'default' | 'danger';
  icon?: IconName;
  input?: DialogInput;
}

interface Open { opts: DialogOptions; resolve: (v: string | boolean | null) => void; }

/**
 * Diálogos propios en lugar de confirm()/prompt() del navegador: siguen el tema, se leen en el celular,
 * atrapan el foco, cierran con Escape y nombran la acción en el botón.
 */
@Injectable({ providedIn: 'root' })
export class Dialogs {
  readonly current = signal<Open | null>(null);

  confirm(opts: DialogOptions): Promise<boolean> {
    return new Promise(resolve => this.current.set({ opts, resolve: v => resolve(v === true) }));
  }

  /** Devuelve el texto escrito o null si se canceló. */
  prompt(opts: DialogOptions & { input: DialogInput }): Promise<string | null> {
    return new Promise(resolve => this.current.set({ opts, resolve: v => resolve(typeof v === 'string' ? v : null) }));
  }
}

@Component({
  selector: 'bx-dialog-host',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
  <dialog #dlg class="dlg" (cancel)="$event.preventDefault(); close(false)" (click)="onBackdrop($event)"
          [attr.aria-labelledby]="'dlg-title'" [attr.aria-describedby]="o()?.opts?.message ? 'dlg-msg' : null">
    @if (o(); as d) {
      <form class="box" method="dialog" (ngSubmit)="accept()">
        <div class="head">
          @if (d.opts.icon || d.opts.tone === 'danger') {
            <span class="ico" [class.danger]="d.opts.tone === 'danger'"><bx-icon [name]="d.opts.icon ?? 'triangle-alert'" /></span>
          }
          <h2 id="dlg-title">{{ d.opts.title }}</h2>
        </div>
        @if (d.opts.message) { <p id="dlg-msg" class="msg">{{ d.opts.message }}</p> }
        @if (d.opts.input; as i) {
          <label class="field">
            <span>{{ i.label }}</span>
            <input #field class="input" name="v" [type]="i.type ?? 'text'" [(ngModel)]="value" [placeholder]="i.placeholder ?? ''"
                   [attr.min]="i.min ?? null" [attr.max]="i.max ?? null" autocomplete="off">
            @if (i.hint) { <small class="hint">{{ i.hint }}</small> }
          </label>
        }
        <div class="actions">
          <button type="button" class="btn" (click)="close(false)">{{ d.opts.cancel ?? 'Cancelar' }}</button>
          <button type="submit" class="btn" [class.primary]="d.opts.tone !== 'danger'" [class.danger-solid]="d.opts.tone === 'danger'" [disabled]="!valid()">
            {{ d.opts.confirm ?? 'Aceptar' }}
          </button>
        </div>
      </form>
    }
  </dialog>`,
  styles: [`
    .dlg { width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid var(--line-2); border-radius: 18px;
      background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); }
    .dlg::backdrop { background: var(--scrim); }
    .dlg[open] { animation: pop 200ms var(--ease-out); }
    .dlg[open]::backdrop { animation: fade 200ms ease-out; }
    @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.97); } }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .dlg[open], .dlg[open]::backdrop { animation: none; } }
    .box { display: flex; flex-direction: column; gap: 14px; padding: 22px 22px 18px; }
    .head { display: flex; align-items: center; gap: 12px; }
    .head h2 { font-size: 18px; line-height: 1.3; }
    .ico { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 12px; background: rgba(255,178,56,.16); color: var(--c-amber); --icon-size: 20px; }
    .ico.danger { background: rgba(255,107,91,.14); color: var(--c-red); }
    .msg { color: var(--muted); line-height: 1.55; }
    .hint { color: var(--faint); font-size: 12.5px; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
    .danger-solid { background: #c8372a; border-color: transparent; color: #fff; font-weight: 800; }
    @media (hover: hover) and (pointer: fine) { .danger-solid:hover { filter: brightness(1.08); background: #c8372a; } }
    @media (max-width: 520px) {
      .dlg { margin: auto auto 0; width: 100vw; max-width: 100vw; border-radius: 22px 22px 0 0; border-bottom: 0; }
      .dlg[open] { animation: up 240ms var(--ease-drawer); }
      @keyframes up { from { transform: translateY(100%); } }
      .box { padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
      .actions { flex-direction: column-reverse; }
      .actions .btn { width: 100%; height: 48px; }
    }
  `],
})
export class DialogHostComponent {
  private dialogs = inject(Dialogs);
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private field = viewChild<ElementRef<HTMLInputElement>>('field');
  o = this.dialogs.current;
  value = '';

  constructor() {
    effect(() => {
      const d = this.o();
      const el = this.dlg().nativeElement;
      if (d && !el.open) {
        this.value = d.opts.input?.value ?? '';
        el.showModal();
        setTimeout(() => {
          const f = this.field()?.nativeElement;
          if (f) { f.focus(); f.select(); }
        });
      } else if (!d && el.open) {
        el.close();
      }
    });
  }

  valid(): boolean {
    const i = this.o()?.opts.input;
    if (!i) return true;
    const v = this.value.trim();
    if ((i.required || i.minLength) && v.length < (i.minLength ?? 1)) return false;
    if (i.type === 'number' && v) {
      const n = Number(v);
      if (!Number.isFinite(n) || (i.min != null && n < i.min) || (i.max != null && n > i.max)) return false;
    }
    return true;
  }

  accept(): void {
    if (!this.valid()) return;
    const d = this.o();
    this.dialogs.current.set(null);
    d?.resolve(d.opts.input ? this.value.trim() : true);
  }

  close(_: false): void {
    const d = this.o();
    this.dialogs.current.set(null);
    d?.resolve(d.opts.input ? null : false);
  }

  /** Tocar fuera del recuadro cierra (el clic en el fondo llega al propio <dialog>). */
  onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.close(false);
  }
}
