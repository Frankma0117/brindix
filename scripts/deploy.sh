#!/usr/bin/env bash
# Construye y (re)inicia Brindix con Docker Compose y espera a que responda.
#   cd /opt/brindix && bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Falta .env: corre primero bash scripts/init-env.sh"; exit 1; }
port="$(grep -E '^BRINDIX_PORT=' .env | cut -d= -f2)"; port="${port:-5710}"

docker compose build --pull
docker compose up -d --remove-orphans
echo "Esperando a Brindix en 127.0.0.1:$port ..."
for i in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
    echo "Brindix responde: http://127.0.0.1:$port"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 3
done
echo "No responde. Revisa: docker compose logs --tail 80 backend"
exit 1
