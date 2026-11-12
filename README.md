# Brindix 🍸🎧

Sistema para bares: **cuentas por mesa, carta digital con QR, pedidos desde el celular,
música a pedido, pantalla del bar con publicidad e inventario**. Hecho para empezar con un bar
y crecer a varios (todo guarda `venue_id`).

Su personaje es **Brindix**: una copa de cóctel con audífonos (tragos + música).

| Quién | Qué hace | Dónde |
|---|---|---|
| Cliente (sin registro) | Escanea el QR de su mesa, ve la carta con fotos, pide, pide canciones, llama al mesero o pide la cuenta | `/m/<código>` |
| Mesero | Ve las mesas, abre cuentas, carga rondas por tandas (×1, ×2, ×6…), confirma los pedidos de los clientes, cobra | `/mesero` |
| Administrador | Todo lo del mesero + carta, inventario, mesas y QR, música, publicidad, ventas, equipo, ajustes | `/admin` |
| Pantalla (TV) | Lo que suena, lo que sigue y banners rotando | `/pantalla` |

## Tecnologías

- **backend/**: Java 17, Spring Boot 3.4 (Web, Data JPA, Security con JWT, Validation), Flyway,
  PostgreSQL en producción y H2 en desarrollo, Lombok.
- **frontend/**: Angular 19 (componentes standalone, signals, carga diferida por ruta), SCSS,
  `qrcode` para generar los QR.
- **docs/**: guías (Spotify, arquitectura). **scripts/**: arranque en Windows.
- Despliegue: `docker-compose.yml` (PostgreSQL + backend + nginx con el frontend).

## Arrancar en el computador

Requisitos: Java 17, Maven 3.9, Node 20+.

```bat
scripts\dev.cmd
```

o a mano, en dos consolas:

```bash
cd backend  && mvn spring-boot:run          # http://127.0.0.1:8080  (perfil dev, H2 en backend/data)
cd frontend && npm install && npx ng serve  # http://localhost:4200  (proxy de /api y /uploads al 8080)
```

El primer arranque crea el bar de ejemplo con 27 productos, 13 mesas, 3 banners y dos usuarios:

- administrador: `admin` / `admin12345`
- mesero: `mesero` / `mesero12345`

Cámbialos en **Equipo** antes de usarlo de verdad. Para empezar de cero: `scripts\reset-dev-db.cmd`.

Para probar desde el celular en la misma red Wi-Fi abre `http://<IP-del-PC>:4200` (el servidor
de Angular escucha en todas las interfaces) y agrega esa dirección a `BRINDIX_CORS_ORIGINS` si
llamas al backend directo.

## Producción

```bash
cp .env.example .env    # edita claves, dominio y (opcional) Spotify
docker compose up -d --build
```

Queda escuchando en el puerto `8081`; pon delante el HTTPS del servidor (nginx + certbot o
Caddy). Las fotos subidas viven en el volumen `uploads` y la base en `pgdata`.

## Música y Spotify

Sin configurar nada funciona en **modo manual**. Para conectar Spotify sigue
[docs/SPOTIFY.md](docs/SPOTIFY.md) (incluye la advertencia sobre el uso comercial).

## Cómo está organizado

Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
