# Publicador de redes de Brindix

Publica los videos de Brindix en **YouTube, Instagram, Facebook y TikTok**, con textos pensados para cada red, estudio de marca (logo, portadas, publicaciones) y publicaciones automáticas diarias o semanales. Es **uno solo, el de la plataforma Brindix** (las redes y la marca de Brindix; no uno por bar). Vive dentro de `/plataforma → Publicador`.

## Cómo está armado
- `publisher/` es una copia de [publisher-app](../publisher/VENDORED.md) (el mismo motor que usa Canix). **No se edita aquí**: se cambia en `publisher-app` y se vuelve a copiar con `node <publisher-app>/scripts/vendor.mjs publisher`.
- Corre como el contenedor `publisher` del `docker-compose.yml` (con Chromium para dibujar el estudio). Solo recibe las variables que necesita, no el `.env` completo.
- `frontend/nginx.conf` lo publica en `/publicador/` (mismo dominio, sin subdominio ni otro login).
- **Entrada sin otro login:** `/plataforma → Publicador → Abrir el publicador`. El backend (`PublisherController`, solo súper administrador) crea un ticket firmado de un solo uso (60 s) y el navegador va a `/publicador/sso?ticket=…`; el publicador abre su propia sesión (cookie httpOnly, 12 h).
- **Los videos del estudio llegan solos.** `PublisherSync` (cada minuto) envía cada video terminado (`promo_videos`, estado DONE, con URL https de Spaces) a la bandeja **Por validar** del publicador, con su título («· vertical», «· horizontal»…), texto, portada y referencia `promo-video-<id>`. Si el publicador está caído se reintenta solo. Tú eliges cuál se publica: **Publicar este / Guardar / Descartar**.

## Poner en marcha en el servidor
```bash
cd /opt/brindix && git pull
bash scripts/set-publisher.sh      # genera las claves, construye el contenedor y lo levanta
```
Eso reconstruye también el `frontend` (nginx). Después entra a `https://brindix.cania.app/plataforma → Publicador`.

### Para publicar de verdad (cuentas y apps: lo crea el administrador)
1. Crea las cuentas de **Brindix** en YouTube, Instagram (profesional) + página de Facebook, y TikTok.
2. Crea las apps de Google, Meta y TikTok siguiendo `publisher/docs/REDES.md`. Dirección de retorno en las tres: `https://brindix.cania.app/publicador/api/publisher-oauth/callback`.
3. Pasa las claves al script: `PUBLISHER_GOOGLE_CLIENT_ID=… PUBLISHER_GOOGLE_CLIENT_SECRET=… bash scripts/set-publisher.sh` (idem `PUBLISHER_META_*`, `PUBLISHER_TIKTOK_*`).
4. En el publicador → **Cuentas** → conecta cada red. Hasta que Google y TikTok auditen las apps, los videos salen **privados**.
5. **Aprobar por WhatsApp (opcional):** crea el proyecto «Brindix» en Canix → Plataforma → Sistema → Proyectos conectados, y corre el script con `CANIX_URL`, `CANIX_API_KEY`, `CANIX_WEBHOOK_SECRET`. Webhook en Canix: `https://brindix.cania.app/publicador/api/canix/webhook`.

## Pruebas
- Java: `cd backend && mvn test -Dtest='Publisher*Test'` (ticket conforme a la especificación y cliente contra un publicador simulado).
- Angular: `cd frontend && npx ng build`.
- El motor tiene sus propias pruebas en `publisher-app` (HTTP, modo incrustado, «Por validar», redes simuladas, estudio, automatización).
- **No probado todavía**: `docker compose build publisher` ni el nginx (no hay Docker local); se prueba al correr el script en el servidor.
