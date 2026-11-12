#!/usr/bin/env bash
# Configura el estudio de videos en el servidor: token compartido, voz (Fish Audio) y los accesos del bar demo
# con los que el estudio graba las pantallas reales. Luego construye y levanta el contenedor "studio".
#   bash /opt/brindix/scripts/set-studio.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Falta .env: corre primero bash scripts/init-env.sh"; exit 1; }

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

# Token entre backend y estudio (se genera una vez).
TOKEN="$(get_var .env STUDIO_TOKEN)"
[ -n "$TOKEN" ] || TOKEN="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)"

# Voz: la misma clave de Fish Audio que usa Aula Interactiva / Canix si está en el servidor.
FISH="$(get_var .env FISH_API_KEY)"
for f in /opt/aula-interactiva/.env /opt/canix/.env; do
  [ -n "$FISH" ] || FISH="$(get_var "$f" FISH_API_KEY)"
done
if [ -z "$FISH" ]; then
  read -r -s -p "Clave de Fish Audio (FISH_API_KEY, no se muestra): " FISH; echo
fi
[ -n "$FISH" ] || { echo "Sin FISH_API_KEY la copa no puede hablar."; exit 1; }

# fal.ai para la música de fondo (opcional: sin esto los videos salen sin música).
FAL="$(get_var .env FAL_KEY)"
for f in /opt/aula-interactiva/.env /opt/canix/.env; do
  [ -n "$FAL" ] || FAL="$(get_var "$f" FAL_KEY)"
done

# Accesos del bar demo (ACCESOS-DEMO.txt los escribe scripts/demo-prod.sh).
ADMIN_USER="$(get_var .env STUDIO_ADMIN_USER)"; ADMIN_PASS="$(get_var .env STUDIO_ADMIN_PASS)"
WAITER_USER="$(get_var .env STUDIO_WAITER_USER)"; WAITER_PASS="$(get_var .env STUDIO_WAITER_PASS)"
if [ -z "$ADMIN_PASS" ] && [ -f ACCESOS-DEMO.txt ]; then
  # Formato de demo-prod.sh:  "Administradora (Nombre):  admin  / clave"  y  "Meseros:  laura / clave  ·  andres / clave"
  pair() { sed -E 's/^[^:]*:[[:space:]]*//' | awk -F'·' '{print $1}' | awk -F'/' '{gsub(/[[:space:]]/,"",$1); gsub(/[[:space:]]/,"",$2); print $1" "$2}'; }
  read -r ADMIN_USER ADMIN_PASS < <(grep -iE '^Administrador' ACCESOS-DEMO.txt | head -1 | pair) || true
  read -r WAITER_USER WAITER_PASS < <(grep -iE '^Mesero' ACCESOS-DEMO.txt | head -1 | pair) || true
fi
if [ -z "$ADMIN_PASS" ] || [ -z "$WAITER_PASS" ]; then
  echo "Accesos del bar demo (con ellos el estudio graba las pantallas reales):"
  read -r -p "Usuario administrador [${ADMIN_USER:-admin}]: " a; ADMIN_USER="${a:-${ADMIN_USER:-admin}}"
  read -r -s -p "Clave del administrador (no se muestra): " ADMIN_PASS; echo
  read -r -p "Usuario mesero [${WAITER_USER:-mesero}]: " w; WAITER_USER="${w:-${WAITER_USER:-mesero}}"
  read -r -s -p "Clave del mesero (no se muestra): " WAITER_PASS; echo
fi

grep -q '^# ---- Estudio de videos' .env || printf '\n# ---- Estudio de videos (/plataforma → Videos)\n' >> .env
set_var STUDIO_TOKEN "$TOKEN"
set_var FISH_API_KEY "$FISH"
set_var FISH_MODEL "$(get_var .env FISH_MODEL)"; [ -n "$(get_var .env FISH_MODEL)" ] || set_var FISH_MODEL s2-pro
[ -z "$FAL" ] || set_var FAL_KEY "$FAL"
set_var STUDIO_VENUE "${STUDIO_VENUE:-demo}"
set_var STUDIO_ADMIN_USER "$ADMIN_USER"
set_var STUDIO_ADMIN_PASS "$ADMIN_PASS"
set_var STUDIO_WAITER_USER "$WAITER_USER"
set_var STUDIO_WAITER_PASS "$WAITER_PASS"
chmod 600 .env

echo "Construyendo el estudio (la primera vez descarga Chromium, unos minutos)…"
docker compose build studio
docker compose up -d studio backend
port="$(get_var .env BRINDIX_PORT)"; port="${port:-5710}"
for i in $(seq 1 60); do curl -s "http://127.0.0.1:$port/api/health" >/dev/null && break; sleep 2; done
docker compose exec -T studio curl -fsS http://127.0.0.1:8000/health && echo
echo "Listo. Entra a https://brindix.cania.app/plataforma → Videos y crea el primero."
