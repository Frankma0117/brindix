import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS, IconName } from './icons';

/** Ícono de línea (Lucide). Hereda el color del texto; el tamaño sale de `size` o del font-size (1em). */
@Component({
  selector: 'bx-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="svg()"></svg>`,
  styles: [`
    :host { display: inline-flex; flex: none; width: var(--icon-size, 1.15em); height: var(--icon-size, 1.15em); vertical-align: -0.2em; }
    svg { width: 100%; height: 100%; }
  `],
  host: { '[style.--icon-size]': 'size() ? size() + "px" : null' },
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);
  name = input.required<IconName>();
  size = input<number | null>(null);
  stroke = input(1.9);
  // Contenido fijo generado desde lucide-static: seguro para insertar como SVG.
  svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''));
}
