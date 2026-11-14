// Copia el publicador a la carpeta de un proyecto (p. ej. D:\brindix\publisher) para construir su imagen junto al proyecto.
//   node scripts/vendor.mjs <carpeta-destino>
// Copia el código, los package*.json, tsconfig, Dockerfile y la documentación; NO copia node_modules, data, public ni .env.
// Vuelve a correrlo cuando publisher-app cambie; el destino queda igual que el origen (los archivos que ya no existen se borran).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dst = resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('Uso: node scripts/vendor.mjs <carpeta-destino>');
  process.exit(1);
}
if (dst === src) throw new Error('El destino no puede ser publisher-app mismo.');

const SKIP_TOP = new Set(['data', 'public', '.git', '.env', '.claude', 'docker-compose.yml']);
const SKIP_ANY = new Set(['node_modules', 'dist', '.git']);
if (existsSync(dst)) for (const f of readdirSync(dst)) if (f !== 'VENDORED.md') rmSync(join(dst, f), { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
cpSync(src, dst, {
  recursive: true,
  filter: (p) => {
    // On Windows Node hands over «\\?\D:\…» paths: drop that prefix before comparing with `src`.
    const parts = p.replace(/^\\\\\?\\/, '').slice(src.length + 1).split(/[\\/]/).filter(Boolean);
    return !(parts.length && SKIP_TOP.has(parts[0])) && !parts.some((x) => SKIP_ANY.has(x));
  },
});

let rev = 'desconocida';
try {
  rev = execSync('git rev-parse --short HEAD', { cwd: src }).toString().trim();
} catch {
  /* sin git */
}
writeFileSync(
  join(dst, 'VENDORED.md'),
  `# Copia de publisher-app\n\nEsta carpeta es una copia de \`publisher-app\` (revisión ${rev}). **No se edita aquí**: los cambios se hacen en publisher-app y se vuelven a copiar con\n\n    node <ruta-de-publisher-app>/scripts/vendor.mjs <esta carpeta>\n\nGuía de uso incrustado: docs/INCRUSTADO.md.\n`,
);
console.log(`Copiado a ${dst} (revisión ${rev}).`);
