#!/usr/bin/env bash
# Respaldo de la base MySQL de Brindix (las imágenes ya están en Spaces). Guarda 14 días.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/brindix-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines brindix' | gzip > "$file"
find backups -name 'brindix-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') respaldo $file ($(du -h "$file" | cut -f1))"

# Copia a Spaces (prefijo privado "brindix-respaldos/", aparte de las imágenes) y borra allí lo de más de 7 días.
# Si falla, el respaldo local queda igual. Las claves van por stdin para que no se vean en `ps`.
env_get() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
to_spaces() {
  local ep bucket region key secret keep=7
  ep="$(env_get SPACES_ENDPOINT)"; bucket="$(env_get SPACES_BUCKET)"; region="$(env_get SPACES_REGION)"
  key="$(env_get SPACES_KEY)"; secret="$(env_get SPACES_SECRET)"
  [ -n "$ep" ] && [ -n "$bucket" ] && [ -n "$key" ] && [ -n "$secret" ] || { echo "sin claves de Spaces: no se copia"; return 0; }
  s3() { printf 'user = "%s:%s"\n' "$key" "$secret" | curl -fsS -K - --aws-sigv4 "aws:amz:$region:s3" "$@"; }
  s3 -T "$file" "$ep/$bucket/brindix-respaldos/$(basename "$file")" > /dev/null
  echo "copiado a Spaces: brindix-respaldos/$(basename "$file")"
  local cutoff k d
  cutoff="$(date -d "$keep days ago" +%Y%m%d)"
  for k in $(s3 "$ep/$bucket?list-type=2&prefix=brindix-respaldos/" | grep -o 'brindix-respaldos/brindix-[0-9]\{8\}-[0-9]\{4\}\.sql\.gz'); do
    d="${k#brindix-respaldos/brindix-}"; d="${d:0:8}"
    if [ "$d" -lt "$cutoff" ]; then s3 -X DELETE "$ep/$bucket/$k" > /dev/null && echo "borrado de Spaces: $k"; fi
  done
}
to_spaces || echo "AVISO: no se pudo copiar a Spaces"
