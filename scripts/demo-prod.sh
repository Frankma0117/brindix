#!/usr/bin/env bash
# Crea o rehace el bar de demostración «Candela Brava» en este servidor.
# Uso (en el servidor):  bash /opt/brindix/scripts/demo-prod.sh
# Pide la clave del súper administrador sin mostrarla. Fotos en /opt/brindix/demo-seed/img.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${BRINDIX_PORT:-5710}"
IMG="$(pwd)/demo-seed/img"
[ -d "$IMG" ] || { echo "Faltan las fotos en $IMG"; exit 1; }

read -r -s -p "Clave del súper administrador (usuario brindix): " SUPER_PASS; echo
ADMIN_PASS="candela-$(tr -dc 'a-z0-9' </dev/urandom | head -c 6)"
WAITER_PASS="mesero-$(tr -dc 'a-z0-9' </dev/urandom | head -c 6)"

OUT=$(docker run --rm --network host -v "$(pwd)/scripts:/s:ro" -v "$IMG:/img:ro" node:22-alpine \
  node /s/seed-demo.mjs --api "http://127.0.0.1:$PORT/api" --super brindix --super-pass "$SUPER_PASS" \
  --images /img --admin-pass "$ADMIN_PASS" --waiter-pass "$WAITER_PASS")
echo "$OUT"

URL=$(echo "$OUT" | sed -n 's/^Carta del cliente (Mesa 4): //p')
if [ -n "$URL" ]; then
  if grep -q '^BRINDIX_DEMO_URL=' .env; then sed -i "s#^BRINDIX_DEMO_URL=.*#BRINDIX_DEMO_URL=$URL#" .env
  else echo "BRINDIX_DEMO_URL=$URL" >> .env; fi
  docker compose up -d backend >/dev/null
fi

cat > ACCESOS-DEMO.txt <<EOF
Bar demo Candela Brava — https://brindix.cania.app/candela-brava
Administrador:  admin  / $ADMIN_PASS
Meseros:        laura  / $WAITER_PASS    ·   andres / $WAITER_PASS
Carta (Mesa 4): https://brindix.cania.app$URL
Pantalla TV:    https://brindix.cania.app/candela-brava/pantalla
EOF
chmod 600 ACCESOS-DEMO.txt
echo; cat ACCESOS-DEMO.txt
