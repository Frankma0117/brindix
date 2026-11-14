# CLAUDE.md — publisher-app

Publicador de redes (YouTube, Instagram, Facebook, TikTok) como servicio independiente: **una copia por proyecto**
(Brindix, cania-web, aula-interactiva…), cada una con su BD, marca, cuentas y claves. Responde SIEMPRE en español.
Código e identificadores en inglés; texto visible en español. Sin `confirm()/prompt()/alert()`.

## Mapa
- `backend/` — Node 20 + TS (ESM), Express, SQLite (better-sqlite3), Playwright. `src/services/publisher` (módulo: cola, SEO,
  `providers/` de cada red, `studio/`, `automation/`, `canix-client.ts`), `src/services/assets` (biblioteca), `src/services/storage.ts`,
  `src/api` (login propio, rutas), `src/database` (esquemas).
- `frontend/` — React + Vite, compila a `public/`. `README.md`, `docs/REDES.md`, `.env.example`.
- Datos locales: `data/` (BD, archivos, clave de cifrado, contraseña). Nunca imprimir `.env` ni secretos.

## Comandos
- Node 20: `PATH="/c/Users/Asus/node20:$PATH"`. `npm run typecheck` · `npm run build` · `npm start`.
- Pruebas con BD temporal (`DB_PATH=data/t.db`), con `AI_API_KEY=` y `FAL_KEY=` vacíos (no gastar IA). Edge para el estudio: `PROMO_BROWSER=msedge`.

## Reglas
- Es derivado del módulo de Canix (`d:\canix\backend\src\services\publisher`): un arreglo del módulo se porta a las dos copias.
  Diferencia: aquí `item_kind = 'asset'` y los videos salen de la biblioteca (no se generan).
- Las acciones con costo (arte con IA) cuentan contra el tope mensual (`generation_cap`).
- Confirmaciones con reacciones 👍/👎 (vía Canix); nunca encuestas.
- Los otros proyectos del servidor no se tocan; este servicio va en su propia carpeta y su propio subdominio.
