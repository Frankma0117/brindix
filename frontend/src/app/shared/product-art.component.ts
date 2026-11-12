import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Foto del producto o, si no tiene, una ilustración según el tipo (art de la categoría).
 * Así la carta se ve bonita desde el primer día, antes de tomar fotos.
 */
@Component({
  selector: 'bx-art',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  @if (imageUrl() && !failed()) {
    <img [src]="imageUrl()" [alt]="name()" loading="lazy" (error)="failed.set(true)">
  } @else {
    <div class="art" [attr.data-art]="kind()">
      <span class="orb o1"></span><span class="orb o2"></span>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        @switch (kind()) {
          @case ('beer') {
            <path d="M30 26 L70 26 L65 88 Q64 92 60 92 L40 92 Q36 92 35 88 Z" fill="#ffc94d" stroke="#fff" stroke-opacity=".8" stroke-width="2.5"/>
            <path d="M33 42 L67 42 L64 86 L36 86 Z" fill="#ffb02e"/>
            <path d="M70 40 q14 0 14 14 v10 q0 12 -14 12" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4"/>
            <circle cx="34" cy="26" r="8" fill="#fffaf0"/><circle cx="46" cy="22" r="10" fill="#fffaf0"/>
            <circle cx="58" cy="23" r="9" fill="#fffaf0"/><circle cx="68" cy="27" r="7" fill="#fffaf0"/>
            <circle cx="45" cy="62" r="2" fill="#fff" opacity=".7"/><circle cx="55" cy="72" r="1.6" fill="#fff" opacity=".7"/>
            <circle cx="50" cy="52" r="1.3" fill="#fff" opacity=".7"/><rect x="38" y="46" width="4" height="34" rx="2" fill="#fff" opacity=".35"/>
          }
          @case ('cocktail') {
            <line x1="62" y1="14" x2="54" y2="42" stroke="#f5e6c8" stroke-width="2"/><circle cx="61" cy="20" r="5.5" fill="#e53950"/>
            <path d="M20 30 L80 30 L53 62 Q50 65 47 62 Z" fill="#ff6fa3" stroke="#fff" stroke-opacity=".85" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M28 36 L44 36 L37 44 Z" fill="#fff" opacity=".35"/>
            <rect x="48" y="63" width="4" height="22" fill="#fff" opacity=".85"/><ellipse cx="50" cy="87" rx="16" ry="4" fill="#fff" opacity=".85"/>
            <path d="M74 30 a9 9 0 0 0 -16 0 Z" fill="#c6f36b"/>
          }
          @case ('spirit') {
            <path d="M26 36 L74 36 L70 86 Q69 90 65 90 L35 90 Q31 90 30 86 Z" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-opacity=".85" stroke-width="2.5"/>
            <path d="M29 58 L71 58 L69 85 L31 85 Z" fill="#d9822b"/>
            <rect x="35" y="44" width="16" height="16" rx="3" fill="#dff6ff" opacity=".8" transform="rotate(-12 43 52)"/>
            <rect x="50" y="48" width="15" height="15" rx="3" fill="#dff6ff" opacity=".7" transform="rotate(14 57 55)"/>
            <path d="M58 30 q8 -14 20 -10" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>
          }
          @case ('shot') {
            <path d="M34 40 L66 40 L62 86 Q61 89 58 89 L42 89 Q39 89 38 86 Z" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-opacity=".9" stroke-width="2.5"/>
            <path d="M36 54 L64 54 L61 85 L39 85 Z" fill="#ffcc33"/>
            <path d="M52 40 a14 14 0 0 1 26 -6 Z" fill="#c6f36b" stroke="#8bc34a" stroke-width="1.5"/>
            <circle cx="30" cy="28" r="3" fill="#fff" opacity=".9"/><circle cx="24" cy="36" r="2" fill="#fff" opacity=".8"/><circle cx="36" cy="22" r="1.6" fill="#fff" opacity=".8"/>
          }
          @case ('wine') {
            <path d="M32 18 L68 18 Q72 48 50 58 Q28 48 32 18 Z" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-opacity=".85" stroke-width="2.5"/>
            <path d="M33 34 L67 34 Q66 50 50 56 Q34 50 33 34 Z" fill="#b0123f"/>
            <rect x="48" y="58" width="4" height="24" fill="#fff" opacity=".85"/><ellipse cx="50" cy="84" rx="15" ry="4" fill="#fff" opacity=".85"/>
          }
          @case ('soft') {
            <rect x="57" y="8" width="5" height="40" rx="2" fill="#ff4f8b" transform="rotate(12 59 28)"/>
            <path d="M32 28 L68 28 L64 88 Q63 91 60 91 L40 91 Q37 91 36 88 Z" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-opacity=".9" stroke-width="2.5"/>
            <path d="M34 42 L66 42 L63 87 L37 87 Z" fill="#58e0c3"/>
            <circle cx="34" cy="30" r="10" fill="#fff36b" stroke="#ffd400" stroke-width="2"/><path d="M34 22 v16 M26 30 h16 M28 24 l12 12 M40 24 l-12 12" stroke="#ffd400" stroke-width="1.2"/>
            <circle cx="46" cy="66" r="2" fill="#fff" opacity=".8"/><circle cx="56" cy="56" r="1.6" fill="#fff" opacity=".8"/><circle cx="52" cy="76" r="1.4" fill="#fff" opacity=".8"/>
          }
          @case ('coffee') {
            <path d="M40 16 q-6 8 0 14 q6 6 0 12 M52 12 q-6 8 0 14 q6 6 0 12" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7" stroke-linecap="round"/>
            <path d="M24 46 L72 46 L68 80 Q66 88 58 88 L38 88 Q30 88 28 80 Z" fill="#fff" opacity=".92"/>
            <path d="M72 52 q14 0 12 14 q-2 10 -16 10" fill="none" stroke="#fff" stroke-width="5" opacity=".92"/>
            <ellipse cx="48" cy="47" rx="23" ry="4" fill="#6b3a1e"/>
          }
          @default {
            <path d="M30 40 L70 40 L64 90 L36 90 Z" fill="#ff4d4d"/>
            <rect x="34" y="18" width="7" height="34" rx="2" fill="#ffd166" transform="rotate(-10 37 35)"/>
            <rect x="44" y="12" width="7" height="38" rx="2" fill="#ffc94d"/>
            <rect x="54" y="16" width="7" height="36" rx="2" fill="#ffd166" transform="rotate(8 57 34)"/>
            <rect x="62" y="22" width="7" height="30" rx="2" fill="#ffc94d" transform="rotate(16 65 37)"/>
            <path d="M30 40 L70 40 L67 56 Q50 64 33 56 Z" fill="#e53935"/>
            <circle cx="50" cy="70" r="7" fill="#fff" opacity=".9"/><path d="M47 70 h6" stroke="#e53935" stroke-width="2"/>
          }
        }
      </svg>
    </div>
  }`,
  styles: [`
    :host { display: block; position: relative; overflow: hidden; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .art { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(140deg, var(--a1), var(--a2)); }
    .art svg { width: 66%; height: 66%; filter: drop-shadow(0 8px 14px rgba(0,0,0,.28)); position: relative; }
    .orb { position: absolute; border-radius: 50%; background: rgba(255,255,255,.14); }
    .o1 { width: 70%; aspect-ratio: 1; top: -22%; right: -20%; }
    .o2 { width: 40%; aspect-ratio: 1; bottom: -14%; left: -10%; background: rgba(0,0,0,.12); }
    [data-art=beer]     { --a1: #ff9f1c; --a2: #c2410c; }
    [data-art=cocktail] { --a1: #ff5c6c; --a2: #9f1d2e; }
    [data-art=spirit]   { --a1: #a16207; --a2: #3b1d0b; }
    [data-art=shot]     { --a1: #f59e0b; --a2: #b91c1c; }
    [data-art=wine]     { --a1: #9f1239; --a2: #3b0718; }
    [data-art=soft]     { --a1: #14b8a6; --a2: #4d7c0f; }
    [data-art=coffee]   { --a1: #92400e; --a2: #2b1408; }
    [data-art=food]     { --a1: #fb923c; --a2: #9a3412; }
  `],
})
export class ProductArtComponent {
  art = input<string | undefined | null>('food');
  imageUrl = input<string | undefined | null>(null);
  name = input('');
  failed = signal(false);
  kind = computed(() => {
    const a = this.art() ?? 'food';
    return ['beer', 'cocktail', 'spirit', 'shot', 'wine', 'soft', 'coffee', 'food'].includes(a) ? a : 'food';
  });
}
