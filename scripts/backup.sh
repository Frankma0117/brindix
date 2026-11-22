#!/usr/bin/env bash
# Respaldo de la base MySQL de Brindix (las imágenes ya están en Spaces). Guarda 14 días.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/brindix-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines brindix' | gzip > "$file"
find backups -name 'brindix-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') respaldo $file ($(du -h "$file" | cut -f1))"
