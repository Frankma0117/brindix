import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Brindix: una copa de cóctel con audífonos. Junta las dos cosas del bar: tragos y música.
 * mood: happy (normal), wink (guiño), party (con notas musicales flotando).
 */
@Component({
  selector: 'bx-mascot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <svg [attr.width]="size()" [attr.height]="size() * 1.17" viewBox="0 0 120 140" role="img" aria-label="Brindix"
       [class.animate]="animate()" class="mascot">
    @if (mood() === 'party') {
      <g class="notes">
        <path class="n1" d="M6 30 v-14 l10 -3 v14" fill="none" stroke="#3ee0d0" stroke-width="2.5" stroke-linecap="round"/>
        <circle class="n1" cx="4" cy="30" r="3.2" fill="#3ee0d0"/><circle class="n1" cx="14" cy="27" r="3.2" fill="#3ee0d0"/>
        <path class="n2" d="M110 22 v-13" stroke="#ff4f8b" stroke-width="2.5" stroke-linecap="round"/>
        <path class="n2" d="M110 9 q6 2 6 8" fill="none" stroke="#ff4f8b" stroke-width="2.5" stroke-linecap="round"/>
        <circle class="n2" cx="107.5" cy="22" r="3.4" fill="#ff4f8b"/>
      </g>
    }
    <!-- palillo con aceituna -->
    <line x1="74" y1="22" x2="88" y2="58" stroke="#e9d8a6" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="80" cy="36" r="6.5" fill="#7cb342"/><circle cx="81.5" cy="35" r="2.2" fill="#e53935"/>
    <!-- audífonos: diadema -->
    <path d="M17 56 C14 12, 106 12, 103 56" fill="none" stroke="#2a2236" stroke-width="7" stroke-linecap="round"/>
    <path d="M17 56 C14 12, 106 12, 103 56" fill="none" stroke="#8b7fa8" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <!-- copa -->
    <path d="M18 44 L102 44 L65 94 Q60 100 55 94 Z" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.75)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M27 52 L93 52 L63 91 Q60 95 57 91 Z" fill="url(#bxLiquid)"/>
    <path d="M31 55 L46 55 L40 64 Z" fill="rgba(255,255,255,.35)"/>
    <!-- limón en el borde -->
    <path d="M20 44 a11 11 0 0 1 22 0 Z" fill="#c6f36b" stroke="#8bc34a" stroke-width="1.5"/>
    <path d="M31 44 L25 37 M31 44 L31 34 M31 44 L37 37" stroke="#8bc34a" stroke-width="1.2"/>
    <!-- cara -->
    <g class="eyes">
      @if (mood() === 'wink') {
        <path d="M45 66 q5 -4 10 0" fill="none" stroke="#2a1606" stroke-width="2.6" stroke-linecap="round"/>
      } @else {
        <ellipse cx="50" cy="66" rx="4.2" ry="5" fill="#2a1606"/><circle cx="51.5" cy="64" r="1.5" fill="#fff"/>
      }
      <ellipse cx="70" cy="66" rx="4.2" ry="5" fill="#2a1606"/><circle cx="71.5" cy="64" r="1.5" fill="#fff"/>
    </g>
    <circle cx="43" cy="74" r="3.5" fill="#ff7aa8" opacity=".55"/><circle cx="77" cy="74" r="3.5" fill="#ff7aa8" opacity=".55"/>
    <path d="M52 75 Q60 84 68 75" fill="#7a2e12" stroke="#2a1606" stroke-width="2" stroke-linejoin="round"/>
    <!-- almohadillas -->
    <rect x="7" y="46" width="15" height="26" rx="7" fill="#ff4f8b"/><rect x="10" y="50" width="5" height="18" rx="2.5" fill="#ff8fb5"/>
    <rect x="98" y="46" width="15" height="26" rx="7" fill="#ff4f8b"/><rect x="105" y="50" width="5" height="18" rx="2.5" fill="#ff8fb5"/>
    <!-- tallo y base -->
    <rect x="57" y="96" width="6" height="28" rx="3" fill="rgba(255,255,255,.7)"/>
    <ellipse cx="60" cy="127" rx="25" ry="6" fill="rgba(255,255,255,.75)"/>
    <ellipse cx="60" cy="125.5" rx="19" ry="3" fill="rgba(255,255,255,.35)"/>
    <defs>
      <linearGradient id="bxLiquid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd166"/><stop offset=".55" stop-color="#ffb238"/><stop offset="1" stop-color="#ff7a45"/>
      </linearGradient>
    </defs>
  </svg>`,
  styles: [`
    :host { display: inline-block; line-height: 0; }
    .animate { animation: bob 3.2s ease-in-out infinite; transform-origin: 50% 90%; }
    .animate .eyes { animation: blink 4.5s infinite; transform-origin: 60px 66px; }
    .notes .n1 { animation: float 2.6s ease-in-out infinite; }
    .notes .n2 { animation: float 2.6s ease-in-out .9s infinite; }
    @keyframes bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-4px) rotate(2deg); } }
    @keyframes blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes float { 0%,100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(-5px); opacity: .6; } }
    @media (prefers-reduced-motion: reduce) { .animate, .animate .eyes, .notes * { animation: none; } }
  `],
})
export class MascotComponent {
  size = input(96);
  mood = input<'happy' | 'wink' | 'party'>('happy');
  animate = input(true);
}
