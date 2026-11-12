#!/usr/bin/env bash
# Crea /opt/brindix/.env la primera vez: genera claves aleatorias y copia las credenciales
# de Spaces, fal.ai y la IA desde el .env de Aula Interactiva (mismo servidor, mismo bucket).
# No sobreescribe un .env existente.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then echo ".env ya existe, no se toca."; exit 0; fi

rand() { head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "${1:-40}"; }
src=/opt/aula-interactiva/.env
copy() { [ -f "$src" ] && grep -E "^$1=" "$src" | tail -1 | cut -d= -f2- || true; }

super_pass="$(rand 14)"
admin_pass="$(rand 12)"
waiter_pass="$(rand 12)"

sed \
  -e "s|^DATABASE_PASSWORD=.*|DATABASE_PASSWORD=$(rand 28)|" \
  -e "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(rand 28)|" \
  -e "s|^BRINDIX_JWT_SECRET=.*|BRINDIX_JWT_SECRET=$(rand 64)|" \
  -e "s|^BRINDIX_SECRET_KEY=.*|BRINDIX_SECRET_KEY=$(rand 64)|" \
  -e "s|^BRINDIX_SUPER_PASSWORD=.*|BRINDIX_SUPER_PASSWORD=$super_pass|" \
  -e "s|^BRINDIX_ADMIN_PASSWORD=.*|BRINDIX_ADMIN_PASSWORD=$admin_pass|" \
  -e "s|^BRINDIX_WAITER_PASSWORD=.*|BRINDIX_WAITER_PASSWORD=$waiter_pass|" \
  -e "s|^SPACES_REGION=.*|SPACES_REGION=$(copy SPACES_REGION)|" \
  -e "s|^SPACES_ENDPOINT=.*|SPACES_ENDPOINT=$(copy SPACES_ENDPOINT)|" \
  -e "s|^SPACES_BUCKET=.*|SPACES_BUCKET=$(copy SPACES_BUCKET)|" \
  -e "s|^SPACES_KEY=.*|SPACES_KEY=$(copy SPACES_KEY)|" \
  -e "s|^SPACES_SECRET=.*|SPACES_SECRET=$(copy SPACES_SECRET)|" \
  -e "s|^AI_API_KEY=.*|AI_API_KEY=$(copy AI_API_KEY)|" \
  -e "s|^FAL_KEY=.*|FAL_KEY=$(copy FAL_KEY)|" \
  .env.example > .env
chmod 600 .env

{
  echo "Brindix — accesos iniciales ($(date '+%Y-%m-%d'))"
  echo "Plataforma:  https://brindix.cania.app/plataforma  usuario brindix  clave $super_pass"
  echo "Bar demo:    https://brindix.cania.app/demo        admin / $admin_pass   ·   mesero / $waiter_pass"
} > ACCESOS.txt
chmod 600 ACCESOS.txt
echo ".env creado. Accesos iniciales en $(pwd)/ACCESOS.txt (no va a git)."
