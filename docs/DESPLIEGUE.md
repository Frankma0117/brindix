# Despliegue de Brindix

Destino: `https://brindix.cania.app` → contenedores en `127.0.0.1:5710`, carpeta `/opt/brindix`
(mismo VPS que Aula Interactiva y Canix). Base MySQL 8.4 en su contenedor; imágenes en
DigitalOcean Spaces, bucket `cania-storage`, carpeta **`brindix/<bar>/`**.

## Primera vez

```bash
ssh manuel@169.58.79.154
git clone git@github.com:Frankma0117/brindix.git /opt/brindix
cd /opt/brindix
bash scripts/init-env.sh     # crea .env (claves nuevas + Spaces/fal/IA copiadas de Aula Interactiva) y ACCESOS.txt
bash scripts/deploy.sh       # construye y arranca (la primera vez tarda ~5 min)
sudo bash scripts/sudo-setup.sh   # ÚNICO paso con sudo: nginx + certbot + respaldo diario
```

`ACCESOS.txt` (no va a git) tiene la clave del súper administrador (`/plataforma`) y del bar `demo`.

## Actualizar

```bash
cd /opt/brindix && git pull && bash scripts/deploy.sh
```

## Imágenes de prueba (una sola vez)

```bash
python3 scripts/seed-images.py --venue demo --user admin --password '<clave del admin del demo>'
```

Genera una foto por producto y por banner con fal.ai y las sube a Spaces por la API de Brindix.

## Útil

| Qué | Cómo |
|---|---|
| Estado | `curl -s http://127.0.0.1:5710/api/health` |
| Logs | `docker compose logs --tail 80 backend` |
| Respaldo manual | `bash scripts/backup.sh` (queda en `backups/`, 14 días) |
| Restaurar | `gunzip -c backups/<archivo>.sql.gz \| docker compose exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" brindix'` |
| Olvidé la clave del admin de un bar | Súper administrador → `/plataforma` → «Clave admin» |
