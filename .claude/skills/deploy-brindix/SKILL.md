---
name: deploy-brindix
description: Despliega Brindix en /opt/brindix (Docker). Úsala cuando pidan desplegar o actualizar brindix en producción.
---

1. Commit y `git push origin main` (el repo es Frankma0117/brindix; commit y push en cada avance).
2. Servidor: `ssh manuel@169.58.79.154`, carpeta `/opt/brindix`, Docker Compose, puerto 127.0.0.1:5710.
3. Actualizar: `ssh manuel@169.58.79.154 "cd /opt/brindix && git pull --ff-only && bash scripts/deploy.sh"`.
   El script construye, reinicia y espera `/api/health`.
4. Verifica: `curl -fsS https://brindix.cania.app/api/health` y `docker compose logs --tail 40 backend` si falla.
5. Cuentas reales del servidor: nunca cambiar claves. Scripts que piden sudo (`sudo-setup.sh`) los corre el usuario.
