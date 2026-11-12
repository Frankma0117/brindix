#!/usr/bin/env bash
# Revisa por qué no llegan los correos, da de alta cania.app en Brevo y deja Brindix enviando con un remitente válido.
# Uso (en el servidor):  bash /opt/brindix/scripts/brevo-setup.sh
# Pide la API key de Brevo (Configuración → SMTP y API → pestaña "Claves API", empieza por xkeysib-) sin mostrarla.
set -uo pipefail
cd "$(dirname "$0")/.."

read -r -s -p "API key de Brevo (xkeysib-…, no se muestra): " BREVO_API_KEY; echo
read -r -s -p "Token de la API de Hostinger (opcional, Enter para omitir): " HOSTINGER_TOKEN; echo
TO=$(grep '^BRINDIX_ADMIN_EMAIL=' .env | cut -d= -f2-)
FROM=$(grep '^BRINDIX_MAIL_FROM=' .env | cut -d= -f2-)

OUT=$(docker run --rm -e BREVO_API_KEY="$BREVO_API_KEY" -e HOSTINGER_TOKEN="$HOSTINGER_TOKEN" -e DOMAIN=cania.app \
  -e TO="$TO" -e FROM="${FROM:-no-responder@cania.app}" -v "$(pwd)/scripts:/s:ro" node:22-alpine node /s/brevo-setup.mjs)
echo "$OUT"

READY=$(echo "$OUT" | sed -n 's/^REMITENTE_LISTO=//p')
AUTH=$(echo "$OUT" | sed -n 's/^DOMINIO_AUTENTICADO=//p')
if [ -n "$READY" ] && [ "$READY" != "$FROM" ]; then
  echo
  read -r -p "¿Usar ${READY} como remitente mientras se verifica cania.app? [s/N] " OK
  if [ "${OK,,}" = "s" ]; then
    sed -i "s#^BRINDIX_MAIL_FROM=.*#BRINDIX_MAIL_FROM=$READY#" .env
    docker compose up -d backend >/dev/null && echo "Brindix ahora envía desde $READY."
  fi
fi
if [ "$AUTH" = "si" ] && [ "$FROM" != "no-responder@cania.app" ]; then
  sed -i "s#^BRINDIX_MAIL_FROM=.*#BRINDIX_MAIL_FROM=no-responder@cania.app#" .env
  docker compose up -d backend >/dev/null && echo "cania.app autenticado: Brindix vuelve a enviar desde no-responder@cania.app."
fi
