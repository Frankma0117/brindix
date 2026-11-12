# Arquitectura de Brindix

## Varios bares

Todo cuelga de `venues` (el bar) y cada fila guarda `venue_id`. Las páginas públicas usan el
**slug** del bar (`/api/public/{slug}/...`); el personal entra con `venue + usuario + contraseña`
y el token ya trae su bar, así que `/api/staff` y `/api/admin` nunca reciben el bar por parámetro.
El súper administrador (`platform_users`) no pertenece a ningún bar.

## Backend (`backend/src/main/java/com/brindix`)

| Paquete | Qué guarda / hace |
|---|---|
| `platform` | Súper administrador, alta de bares (`VenueStarter`: admin, mesas y carta de ejemplo). |
| `venue` | Datos del bar, reglas de pedidos/cobros/música, claves de Spotify/YouTube **cifradas** (`common/Crypto`), llave de la pantalla. |
| `staff` / `security` | Perfiles `ADMIN` y `WAITER`, JWT, bloqueo tras 5 intentos, el filtro recarga usuario y bar en cada solicitud. |
| `catalog` | Categorías y productos (precio de venta y costo), orden por arrastre, edición rápida. |
| `orders` | `Tab` (cuenta) → `Round` (ronda) → `RoundItem`; `Payment` (cobro de una o varias rondas); llamados. |
| `cash` | Turnos de caja (`CashShift`) y entradas/salidas (`CashMovement`). |
| `inventory` | Kardex; costo promedio ponderado en cada entrada; entrada pagada de la caja. |
| `music` | Cola por bar; Spotify (OAuth por bar), YouTube (búsqueda + reproductor en la pantalla), manual. |
| `reports` | Ventas, ganancia por producto, tablero en vivo, reporte de cierre de caja. |
| `audit` | Bitácora de todo lo delicado. |
| `uploads` | Imágenes a Spaces (`brindix/<bar>/<carpeta>/`) o disco; reduce a 1600 px. |
| `ai` | Descripción de producto con IA (DeepSeek, API compatible con OpenAI). |

### Reglas importantes

- **Recuperar contraseña** (personal): se pide en `/<bar>/recuperar` (respuesta igual exista o no el usuario, 5 por IP
  cada 15 min); la aprueba otro administrador del bar en Equipo o el súper administrador en la plataforma; el código
  (8 caracteres, 30 min, un solo uso, 5 intentos) se guarda como SHA-256. Súper administrador: `BRINDIX_RECOVERY_KEY`.
- **Versión de sesión** (`token_version` en el JWT `ver`): cambiar o restablecer la contraseña cierra las demás sesiones.

- **Clave temporal**: las cuentas nuevas, las claves puestas por otro y las sembradas tienen
  `must_change_password`; mientras no la cambien, el backend solo deja cambiarla (403 `PASSWORD_CHANGE_REQUIRED`).
- **Modo soporte**: token `support` (4 h) que firma el súper administrador; el bar lo ve como su
  administrador pero con nombre "Soporte Brindix (…)", no puede cambiar la clave del administrador y la entrada queda en la bitácora.

- **Mesero**: agrega rondas (quedan confirmadas, descuentan inventario y quedan asignadas a él),
  entrega las suyas y cobra solo si `waiter_can_charge`. No modifica nada ni da descuentos.
- **Administrador que atiende** (bares pequeños): tiene también `ROLE_WAITER`; puede asignarse rondas
  a sí mismo ("Yo lo llevo"), entregar y cobrar. Su cobro queda `settled=true` al instante.
- **Pedido del cliente** (solo si `client_orders_enabled`): queda `PENDING`; el administrador lo
  **asigna** a un mesero (pasa a `CONFIRMED` y descuenta inventario) o lo rechaza.
- **Modificar** (cambiar cantidad, anular, reasignar) es solo del administrador, con motivo, y
  queda en la bitácora. Lo ya **cobrado no se modifica**: primero se anula el cobro (solo en el turno abierto).
- **Cobrar**: por ronda o todo; requiere **caja abierta**. Si cobra un mesero, el pago queda
  `settled=false` (en su poder) hasta que el administrador lo recibe; no se cierra la caja con pendientes.
- **Efectivo esperado** = base + cobros en efectivo recibidos + entradas en efectivo − salidas en efectivo.
- **Ganancia** = lo cobrado (sin propina, menos descuentos) − costo congelado en `round_items.unit_cost`.
- Día contable de 6:00 a. m. a 6:00 a. m.

### Base de datos

Migraciones Flyway en `db/migration`, SQL compatible con MySQL 8 y H2 (modo MySQL). Fechas en UTC
(`DATETIME(6)` + `hibernate.jdbc.time_zone=UTC`). Nunca editar una migración aplicada: crear `V2__…`.

## Frontend (`frontend/src/app`)

| Carpeta | Contenido |
|---|---|
| `landing/` | Página de ventas de Brindix (`/`). |
| `platform/` | Panel del súper administrador (`/plataforma`). |
| `core/` | API, sesiones (`Auth` por bar, `PlatformAuth`), `VenueContext` + `VenueShellComponent` (carga el bar de `/:slug`), modelos. |
| `venue/client` | Carta del cliente. `venue/waiter`: tablero, cuenta, selector por tandas. `venue/admin`: panel. `venue/screen`: TV. |
| `shared/` | `bx-mascot` (Brindix animado), `bx-art` (foto o ilustración), `bx-qr`. |

Estilos globales en `src/styles.scss`. Tiempo real por consultas periódicas (5 s mesero, 4 s pantalla).
