# Arquitectura de Brindix

## Backend (`backend/src/main/java/com/brindix`)

Un paquete por módulo; cada uno con su entidad, repositorio, servicio, DTOs (records) y controlador.

| Paquete | Qué guarda / hace |
|---|---|
| `venue` | El bar: nombre, Wi-Fi, reglas de música y pedidos, tokens de Spotify. Hoy `VenueService.current()` = primer bar. |
| `staff` | Usuarios del personal (`ADMIN`, `WAITER`), login con bloqueo tras 5 intentos. |
| `security` | JWT (`JwtService`), filtro que recarga el usuario en cada solicitud, reglas por ruta. |
| `catalog` | Categorías (con ilustración por defecto: `art`) y productos. Productos se archivan, nunca se borran. |
| `tables` | Mesas con `code` aleatorio para el QR (se puede regenerar). |
| `orders` | `Tab` (cuenta por mesa) → `Round` (ronda/tanda) → `RoundItem`. Llamados (`ServiceCall`). |
| `inventory` | Kardex `StockMovement`: ENTRY, SALE, RETURN, ADJUSTMENT, WASTE. |
| `music` | Cola `SongRequest` (orden por `position`), Spotify (cliente HTTP, tokens, sincronización cada 5 s). |
| `banners` | Publicidad para la pantalla y la carta; `/api/public/screen` arma todo lo de la TV. |
| `reports` | Resumen de ventas y tablero en vivo. El día contable empieza a las 6:00 a. m. |
| `uploads` | Subida de imágenes (valida la firma del archivo) servidas en `/uploads/`. |
| `common` | Propiedades, errores en español, datos de ejemplo (`DataSeeder`). |

### Reglas de negocio importantes

- **Ronda del mesero** → queda `CONFIRMED` y descuenta inventario al instante.
- **Pedido del cliente** → `PENDING`; no suma a la cuenta ni descuenta inventario hasta que un
  mesero lo confirma. Máximo 3 pendientes por mesa. No deja pedir agotados.
- **Anular un producto** exige motivo, guarda quién lo anuló y devuelve el inventario (RETURN).
- Nombre y precio quedan **congelados** en `round_items`: cambiar la carta no altera cuentas.
- **Cobrar**: descuento, propina y medio de pago; los pedidos pendientes se rechazan solos.
- El inventario puede quedar negativo (el bar vende aunque no haya registrado la entrada); se
  marca como agotado/bajo para reponer.
- **Música**: límite de canciones activas por mesa, sin duplicados, aprobación opcional,
  prioridad (⏫), subir/bajar, fijar y quitar. Con Spotify, la siguiente se envía al reproductor
  ~25 s antes de terminar la actual, para poder reordenar hasta el último momento.

### Base de datos

Migraciones en `backend/src/main/resources/db/migration` (Flyway). El SQL sirve para PostgreSQL y
para H2 en modo PostgreSQL. Nunca editar una migración ya aplicada en producción: crear `V2__…`.

### API

- `/api/public/**`: sin sesión (carta, mesa por código, pedidos, música, pantalla).
- `/api/staff/**`: mesero o administrador (tablero, cuentas, rondas, llamados).
- `/api/admin/**`: solo administrador.
- `/api/auth/login`, `/api/auth/me`, `/api/auth/password`, `/api/spotify/callback`.

Errores: siempre `{"error": "mensaje en español"}` listo para mostrar.

## Frontend (`frontend/src/app`)

| Carpeta | Contenido |
|---|---|
| `core/` | `Api` (HttpClient), `Auth` (signals + interceptor + guards), modelos, utilidades (`money`, `ago`, avisos). |
| `shared/` | `bx-mascot` (Brindix en SVG), `bx-art` (foto o ilustración por tipo), `bx-qr`. |
| `public/` | Inicio y carta del cliente (`/m/:code`, `/carta`). |
| `screen/` | Pantalla del bar (`/pantalla`), se actualiza cada 4 s. |
| `waiter/` | Tablero de mesas, cuenta y selector de productos por tandas. |
| `admin/` | Panel completo. |

Estilos: un sistema de diseño global en `src/styles.scss` (tokens, botones, tarjetas, formularios,
modales); los componentes casi no tienen estilos propios. Tiempo real por consultas periódicas
(5 s mesero, 4 s pantalla, 10 s cliente).
