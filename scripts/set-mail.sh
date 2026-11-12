#!/usr/bin/env bash
# Conecta el correo de Brindix con Brevo (SMTP). Pide el usuario y la clave SMTP sin mostrarlos y los guarda en .env.
# Uso (en el servidor):  bash /opt/brindix/scripts/set-mail.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Datos en Brevo → SMTP y API → pestaña SMTP (servidor smtp-relay.brevo.com, puerto 587)."
read -r -p "Usuario SMTP (termina en @smtp-brevo.com): " MAIL_USER
read -r -s -p "Clave SMTP (no se muestra): " MAIL_PASS; echo
read -r -p "Remitente [no-responder@cania.app]: " MAIL_FROM
MAIL_FROM="${MAIL_FROM:-no-responder@cania.app}"
read -r -p "Correo del súper administrador [franmacagu@gmail.com]: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-franmacagu@gmail.com}"

# El usuario SMTP de Brevo siempre termina en @smtp-brevo.com (en el panel a veces se copia sin esa parte).
MAIL_USER="$(echo "$MAIL_USER" | tr -d '[:space:]')"
case "$MAIL_USER" in *@*) ;; *) MAIL_USER="$MAIL_USER@smtp-brevo.com"; echo "Usuario completado: ${MAIL_USER:0:4}…@smtp-brevo.com";; esac

# Verifica con Brevo antes de guardar.
AUTH=$(printf '\0%s\0%s' "$MAIL_USER" "$MAIL_PASS" | base64 -w0)
RES=$( { sleep 2; echo "EHLO cania.app"; sleep 1; echo "AUTH PLAIN $AUTH"; sleep 2; echo "QUIT"; } \
  | timeout 20 openssl s_client -starttls smtp -crlf -quiet -connect smtp-relay.brevo.com:587 2>/dev/null | grep -E "^(235|535)" | head -1 || true)
case "$RES" in
  235*) echo "Brevo aceptó el usuario y la clave." ;;
  *) echo "Brevo rechazó el usuario o la clave (${RES:-sin respuesta}). Revisa que sea una clave SMTP (empieza por xsmtpsib-)."; exit 1 ;;
esac

set_var() {
  local k="$1" v="$2"
  if grep -q "^$k=" .env; then
    local tmp; tmp=$(mktemp)
    awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}
grep -q '^# Correo saliente' .env || printf '\n# Correo saliente (Brevo)\n' >> .env
set_var BRINDIX_MAIL_HOST smtp-relay.brevo.com
set_var BRINDIX_MAIL_PORT 587
set_var BRINDIX_MAIL_USERNAME "$MAIL_USER"
set_var BRINDIX_MAIL_PASSWORD "$MAIL_PASS"
set_var BRINDIX_MAIL_FROM "$MAIL_FROM"
set_var BRINDIX_MAIL_FROM_NAME Brindix
set_var BRINDIX_ADMIN_EMAIL "$ADMIN_EMAIL"
chmod 600 .env

docker compose up -d backend >/dev/null
echo "Listo. Reiniciando Brindix con el correo…"
for i in $(seq 1 60); do curl -s "http://127.0.0.1:${BRINDIX_PORT:-5710}/api/health" >/dev/null && break; sleep 2; done
echo "Entra a https://brindix.cania.app/plataforma y pulsa «Enviar correo de prueba»."
