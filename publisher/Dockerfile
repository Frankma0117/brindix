# Publicador: una copia por proyecto. Imagen única: el panel compilado + el servidor + Chromium (para dibujar el estudio).
FROM node:20-bookworm-slim AS panel
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci
COPY frontend frontend
RUN npm --prefix frontend run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Herramientas por si better-sqlite3 tuviera que compilarse, y fuentes (emoji y base) para el estudio de diseño.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 make g++ fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
RUN npm --prefix backend ci \
    && cd backend && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY backend backend
COPY --from=panel /app/public public
EXPOSE 3100
VOLUME /app/data
CMD ["node", "backend/node_modules/tsx/dist/cli.mjs", "backend/src/index.ts"]
