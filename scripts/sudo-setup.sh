#!/usr/bin/env bash
# ÚNICO paso con sudo (una sola vez):
#   sudo bash /opt/brindix/scripts/sudo-setup.sh
# Publica https://brindix.cania.app → 127.0.0.1:5710 (nginx del servidor + certbot) y programa el respaldo diario.
# Solo CREA su propio sitio; no toca los demás proyectos del servidor.
set -euo pipefail
host="${1:-brindix.cania.app}"
port="${2:-5710}"
conf=/etc/nginx/sites-available/brindix

if [ ! -e "$conf" ]; then
  cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $host;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINX
  echo "Sitio creado: $conf"
else
  echo "El sitio ya existía: $conf (sin cambios)"
fi
ln -sf "$conf" /etc/nginx/sites-enabled/brindix
nginx -t
systemctl reload nginx
certbot --nginx -d "$host" --redirect --non-interactive --agree-tos --register-unsafely-without-email \
  --keep-until-expiring || certbot --nginx -d "$host" --redirect
systemctl reload nginx

user="${SUDO_USER:-manuel}"
line="45 3 * * * /opt/brindix/scripts/backup.sh >> /opt/brindix/backups/backup.log 2>&1"
( crontab -u "$user" -l 2>/dev/null | grep -v 'brindix/scripts/backup.sh' ; echo "$line" ) | crontab -u "$user" -
echo "Listo: https://$host  (respaldo diario 3:45 a. m.)"
