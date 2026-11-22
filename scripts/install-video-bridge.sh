#!/usr/bin/env bash
# Instala/reinicia el puente del taller de video como servicio de USUARIO (sin sudo; requiere linger).
#   cd /opt/brindix && bash scripts/install-video-bridge.sh
# Crea /opt/videos/bridge.token (si falta) y agrega BRINDIX_VIDEO_BRIDGE_TOKEN al .env. Idempotente.
set -euo pipefail
cd "$(dirname "$0")/.."
APP="$(pwd)"
TOKEN_FILE=/opt/videos/bridge.token
[ -d /opt/videos/taller ] || { echo "Falta /opt/videos/taller: sin taller de video no hay puente."; exit 0; }
if [ ! -s "$TOKEN_FILE" ]; then
  (umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$TOKEN_FILE")
fi
if [ -f .env ] && ! grep -q '^BRINDIX_VIDEO_BRIDGE_TOKEN=' .env; then
  echo "BRINDIX_VIDEO_BRIDGE_TOKEN=$(cat "$TOKEN_FILE")" >> .env
  echo "Token del puente agregado al .env"
fi
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/brindix-video-bridge.service" <<UNIT
[Unit]
Description=Puente del taller de video para Brindix
After=network.target

[Service]
ExecStart=/usr/bin/node $APP/video-bridge/server.mjs
Restart=always
RestartSec=3
Environment=BRIDGE_HOST=172.17.0.1
Environment=BRIDGE_PORT=5720

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable brindix-video-bridge >/dev/null 2>&1
systemctl --user restart brindix-video-bridge
sleep 1
systemctl --user is-active brindix-video-bridge
