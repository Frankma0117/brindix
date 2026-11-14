#!/usr/bin/env bash
# Configura el publicador de redes en el servidor: genera sus claves (se crean una sola vez), copia lo que ya
# existe (IA, fal.ai), guarda las claves de las redes si las das, y construye y levanta el contenedor "publisher".
#   bash /opt/brindix/scripts/set-publisher.sh
# Opcional, antes de correrlo (o editando el .env después y repitiendo el script):
#   CANIX_URL=https://canix.cania.app CANIX_API_KEY=… CANIX_WEBHOOK_SECRET=…   avisos y aprobación por WhatsApp (Canix → Proyectos conectados)
#   PUBLISHER_GOOGLE_CLIENT_ID=… PUBLISHER_GOOGLE_CLIENT_SECRET=…              YouTube
#   PUBLISHER_META_APP_ID=… PUBLISHER_META_APP_SECRET=…                        Instagram y Facebook
#   PUBLISHER_TIKTOK_CLIENT_KEY=… PUBLISHER_TIKTOK_CLIENT_SECRET=…             TikTok
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Falta .env: corre primero bash scripts/init-env.sh"; exit 1; }
[ -f publisher/Dockerfile ] || { echo "Falta la carpeta publisher/: haz git pull."; exit 1; }

get_var() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- || true; }
set_var() {
  local k="$1" v="$2"
  if grep -q "^$k=" .env; then
    local tmp; tmp=$(mktemp)
    awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}
random() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1" || true; }

grep -q '^# ---- Publicador de redes' .env || printf '\n# ---- Publicador de redes (/plataforma → Publicador)\n' >> .env

# Claves internas: se generan una vez y no se cambian (cambiar PUBLISHER_SECRET dejaría ilegibles las redes ya conectadas).
for k in PUBLISHER_EMBED_SECRET PUBLISHER_API_KEY PUBLISHER_SECRET; do
  [ -n "$(get_var .env $k)" ] || set_var "$k" "$(random 48)"
done

# IA y fal.ai: si el .env no los tiene, los toma de Canix / Aula Interactiva (los mismos del servidor).
for k in FAL_KEY; do
  v="$(get_var .env $k)"
  for f in /opt/canix/.env /opt/aula-interactiva/.env; do [ -n "$v" ] || v="$(get_var "$f" $k)"; done
  [ -z "$v" ] || set_var "$k" "$v"
done

# Lo que se pasó por el entorno al correr el script.
for k in CANIX_URL CANIX_API_KEY CANIX_WEBHOOK_SECRET \
         PUBLISHER_GOOGLE_CLIENT_ID PUBLISHER_GOOGLE_CLIENT_SECRET PUBLISHER_META_APP_ID PUBLISHER_META_APP_SECRET PUBLISHER_META_PAGE_ID \
         PUBLISHER_TIKTOK_CLIENT_KEY PUBLISHER_TIKTOK_CLIENT_SECRET PUBLISHER_YOUTUBE_PRIVACY PUBLISHER_TIKTOK_PRIVACY; do
  [ -z "${!k:-}" ] || set_var "$k" "${!k}"
done
chmod 600 .env

echo "Construyendo el publicador (la primera vez descarga Chromium, unos minutos)…"
docker compose build publisher frontend
docker compose up -d publisher backend frontend
port="$(get_var .env BRINDIX_PORT)"; port="${port:-5710}"
for i in $(seq 1 60); do curl -s "http://127.0.0.1:$port/publicador/api/health" | grep -q '"ok":true' && break; sleep 2; done
curl -fsS "http://127.0.0.1:$port/publicador/api/health" && echo

echo
echo "Listo. Entra a https://brindix.cania.app/plataforma → Publicador."
echo "Falta, cuando quieras publicar de verdad: crear las cuentas y apps de YouTube, Meta y TikTok (publisher/docs/REDES.md),"
echo "pasar sus claves a este script (ver el comienzo del archivo) y, para aprobar por WhatsApp, crear el proyecto en Canix → Proyectos conectados."
echo "Dirección de retorno de las redes: ${BRINDIX_PUBLIC_URL:-https://brindix.cania.app}/publicador/api/publisher-oauth/callback"
echo "Webhook de Canix:                  ${BRINDIX_PUBLIC_URL:-https://brindix.cania.app}/publicador/api/canix/webhook"
