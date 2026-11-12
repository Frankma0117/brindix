// Genera src/app/shared/icons.ts con los íconos de Lucide (ISC) que usa Brindix.
// Uso: node scripts/build-icons.mjs  (requiere lucide-static en devDependencies)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, 'node_modules', 'lucide-static', 'icons');

const NAMES = [
  'arrow-left', 'armchair', 'audio-lines', 'ban', 'banknote', 'beer', 'bell-ring', 'calculator', 'camera',
  'chart-column', 'chart-line', 'check', 'chef-hat', 'chevron-down', 'chevron-right', 'chevrons-up', 'circle-check',
  'clock', 'credit-card', 'crown', 'cup-soda', 'eye', 'eye-off', 'footprints', 'glass-water', 'grip-vertical',
  'hand', 'hand-coins', 'headphones', 'image', 'info', 'layout-grid', 'life-buoy', 'lock', 'log-out', 'map-pin',
  'martini', 'megaphone', 'menu', 'mic', 'minus', 'monitor', 'moon', 'music', 'package', 'party-popper', 'pause',
  'pencil', 'pin', 'play', 'plus', 'printer', 'qr-code', 'receipt', 'refresh-cw', 'scroll-text', 'search',
  'settings', 'shield-check', 'skip-forward', 'smartphone', 'sparkles', 'square', 'star', 'sticky-note', 'store',
  'sun', 'sun-moon', 'trash-2', 'triangle-alert', 'tv', 'upload', 'user', 'users', 'utensils', 'wallet', 'wine', 'x',
];

const out = [];
for (const n of NAMES) {
  const svg = fs.readFileSync(path.join(dir, n + '.svg'), 'utf8');
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .replace(/\s*\n\s*/g, '').trim();
  out.push(`  '${n}': '${inner.replace(/'/g, "\\'")}',`);
}
const file = `// Generado por scripts/build-icons.mjs a partir de lucide-static (ISC). No editar a mano.
export const ICONS: Record<string, string> = {
${out.join('\n')}
};

export type IconName = ${NAMES.map(n => `'${n}'`).join(' | ')};
`;
fs.writeFileSync(path.join(root, 'src', 'app', 'shared', 'icons.ts'), file);
console.log(NAMES.length, 'íconos');
