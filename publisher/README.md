# Publicador

Programa y publica videos e imágenes en **YouTube, Instagram, Facebook y TikTok**, con SEO por red, un estudio de marca (logo, portadas, publicaciones) y un calendario automático con aprobación por WhatsApp.

**Una copia por proyecto, dentro del panel de cada uno** (modo incrustado: [docs/INCRUSTADO.md](docs/INCRUSTADO.md)), o como servicio con su propio login. Cada proyecto (Brindix, cania-web, aula-interactiva…) corre su propio publicador, con su propia base de datos, marca, cuentas y claves. No comparten nada. Es el mismo módulo que usa Canix, empaquetado como servicio independiente: funciona con cualquier stack porque el proyecto solo le entrega archivos.

## Qué incluye
- **Cola y programación:** publica ahora o programa; reintentos con espera; estado por red.
- **SEO por red:** título, descripción y hashtags en la voz de la marca (con IA, o plantilla sin ella).
- **Biblioteca:** sube tus videos e imágenes, tráelos de un enlace, o deja que el software del proyecto los envíe (`POST /api/v1/assets`).
- **Estudio de marca:** identidad visual (colores, letra, estilo), logo, foto de perfil, portadas (banner de YouTube y portada de Facebook), publicaciones e historias. Los textos y el logo los dibuja el estudio con Chromium; la IA de imagen solo pinta el fondo.
- **Automático:** reglas por día y hora («lunes y jueves 8:00: un consejo en Instagram y Facebook»; «los viernes un video de la biblioteca, por turnos»). Modo con tu aprobación o totalmente automático.
- **Aprobar por WhatsApp:** con `CANIX_*` configurado, el aviso llega a tu WhatsApp (con la imagen y un enlace) y apruebas con 👍 / 👎 o con el enlace.

## Ponerlo en marcha (local)
```bash
npm run install:all          # Node 20
cp .env.example .env         # edita PROJECT_NAME, PUBLISHER_ADMIN_PASSWORD…
npm run build                # compila el panel a public/
npm start                    # http://localhost:3100
```
Desarrollo: `npm run dev` (servidor) y `npm run dev:frontend` (panel con recarga, en el puerto de Vite).
Sin contraseña en el `.env`, se crea una al azar en `data/admin-password.txt`.

## En un servidor (Docker)
```bash
cp docker-compose.example.yml docker-compose.yml   # ajusta nombre y puerto
cp .env.example .env                               # PUBLIC_URL, claves…
docker compose up -d --build
```
Publica el puerto con nginx (HTTPS) en un subdominio del proyecto; ese subdominio es el `PUBLIC_URL`. **Respalda `data/`** (base de datos, archivos y la clave de cifrado de los tokens).

## Conectar las redes
Cada proyecto crea sus apps en Google, Meta y TikTok. Guía: [docs/REDES.md](docs/REDES.md). Mientras tanto, en «Cuentas» hay una conexión **Simulada** para probar todo sin publicar de verdad.

## Conectar con Canix (WhatsApp)
En Canix → Plataforma → Sistema → **Proyectos conectados** crea el proyecto y copia su llave y su secreto. En el `.env`: `CANIX_URL`, `CANIX_API_KEY`, `CANIX_WEBHOOK_SECRET`; y en Canix el webhook del proyecto: `<PUBLIC_URL>/api/canix/webhook`.

## API para el software del proyecto
`Authorization: Bearer <PUBLISHER_API_KEY>`
- `POST /api/v1/assets` `{ "url": "https://…/video.mp4", "title": "…", "caption": "…", "ref": "id-del-video" }` → descarga el archivo y lo agrega a la biblioteca. El mismo `ref` dos veces no lo duplica. Solo https y nunca direcciones privadas.

## Cómo está hecho
`backend/` Node 20 + TypeScript (Express, SQLite, Playwright) · `frontend/` React + Vite + Tailwind. El módulo está en `backend/src/services/publisher/` (cola, SEO, proveedores de cada red, estudio, automatización); lo propio de este servicio es `services/assets/` (biblioteca), `services/storage.ts` y `api/`. Es un derivado del módulo de Canix (`docs/PUBLISHER.md` allá): la diferencia es que aquí los videos salen de la biblioteca, no se generan.
