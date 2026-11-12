# Brindix 🍸🎧

Plataforma para bares: **carta con QR, rondas por mesa, pedidos desde la mesa, cobro por ronda
o total, caja con cierre del día, inventario con costos y ganancia, música a pedido (Spotify,
YouTube o manual) y pantalla del bar con publicidad**. Brindix es el servicio general y cada bar
tiene su propio acceso: `brindix.cania.app/<bar>`.

Su personaje es **Brindix**: una copa de cóctel con audífonos.

| Perfil | Qué hace | Dónde |
|---|---|---|
| Súper administrador (dueño de Brindix) | Crea bares, los suspende, recupera la clave de su administrador, entra a cualquier bar en modo soporte | `/plataforma` |
| Administrador del bar | Carta, precios y costos, inventario, caja y cierres, cobros y descuentos, asignar y modificar pedidos, música, pantalla, equipo, configuración. También atiende mesas. | `/<bar>/admin` |
| Mesero | Ve mesas y carta, carga rondas por tandas, entrega lo asignado y (si el bar lo permite) cobra | `/<bar>/mesero` |
| Cliente (sin registro) | Carta con fotos, pedir (si el bar lo activa), pedir canciones, llamar al mesero, ver su cuenta | `/<bar>/m/<código QR>` |
| Pantalla del TV | Lo que suena, lo que sigue, publicidad; con llave reproduce YouTube | `/<bar>/pantalla` |

## Tecnologías

- **backend/**: Java 17, Spring Boot 3.4 (Web, JPA, Security + JWT, Validation), Flyway, **MySQL 8**
  (H2 en modo MySQL para desarrollo), AWS SDK S3 para **DigitalOcean Spaces**.
- **frontend/**: Angular 19 (standalone, signals, carga diferida), CDK drag & drop, `qrcode`.
- Despliegue: Docker Compose (MySQL + backend + nginx) detrás del nginx del servidor. Ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## Arrancar en el computador

Requisitos: Java 17, Maven 3.9, Node 20+.

```bat
scripts\dev.cmd
```

o en dos consolas: `cd backend && mvn spring-boot:run` (puerto 8080) y `cd frontend && npx ng serve` (4200).

El primer arranque crea:
- súper administrador: `brindix` / `brindix12345` en <http://localhost:4200/plataforma>
- bar de demostración en <http://localhost:4200/demo>: `admin` / `admin12345` y `mesero` / `mesero12345`

Al primer ingreso cada cuenta pide cambiar su contraseña (también cuando un administrador o la
plataforma le pone una nueva). Para empezar de cero: `scripts\reset-dev-db.cmd`.

**Modo soporte:** desde `/plataforma` el súper administrador pulsa **Entrar** en cualquier bar y queda
dentro como su administrador (banda ámbar arriba, 4 horas, todo queda en la bitácora del bar).

## Bar de demostración

`scripts/seed-demo.mjs` crea «Candela Brava» (`/candela-brava`): carta con precios reales de Bogotá, fotos
de Wikimedia Commons (créditos en `/creditos`), banners, equipo y una noche en curso. Ver el encabezado del
script para los parámetros. `BRINDIX_DEMO_URL` en el `.env` activa el botón «Ver una carta real» de la landing.

## Música

Se configura **por bar** en Configuración → Música. Guía: [docs/SPOTIFY.md](docs/SPOTIFY.md).

## Más

[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) · [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)
