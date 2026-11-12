# CLAUDE.md — Brindix

Sistema para bares (cuentas por mesa, carta QR, música a pedido, pantalla, inventario).
Proyecto independiente de Canix y Aula Interactiva, con la misma idea de estructura
(`backend/` + `frontend/` + `docs/` + `scripts/`). Responde siempre en español.

## Estado
- [x] 2026-11-11: **Fase 1 completa y probada en local.** Backend Spring Boot (todos los módulos,
      prueba de humo de punta a punta: cuentas, rondas, pedido QR, anulación, kardex, cobro, cola
      de música con prioridad, pantalla, tablero) y frontend Angular 19 (cliente, mesero, pantalla,
      panel admin completo), revisado con capturas en Chrome headless. Spotify programado pero
      **sin probar con una cuenta real** (faltan credenciales).
- [ ] Conectar Spotify con la cuenta real (ver docs/SPOTIFY.md).
- [ ] Desplegar en servidor (docker compose + HTTPS).

## Decisiones
- Nombre/personaje: **Brindix**, copa de cóctel con audífonos (`shared/mascot.component.ts`).
- Un solo bar por ahora, pero todo guarda `venue_id`; `VenueService.current()` = primer bar.
- Pedidos del cliente quedan PENDING hasta que un mesero confirma; solo entonces descuentan inventario.
- Inventario puede quedar negativo (no se bloquea la venta).
- Día contable de 6:00 a 6:00 (`ReportService`, `sales.component.ts`).
- Tiempo real con polling (sin WebSocket) para simplificar.
- Música: la cola de Brindix manda; a Spotify solo se envía la siguiente cuando faltan ~25 s.

## Trampas conocidas
- Node 18 es el predeterminado del PC; Angular necesita Node 20: `C:\Users\Asus\node20` (los scripts lo ponen en el PATH).
- Spring Data **no** detecta repositorios anidados en otra clase: un archivo por repositorio.
- Enums usados en JPQL deben ser de nivel superior (no anidados).
- `Map.of().get(null)` lanza NPE: usar `HashMap` si la clave puede ser nula.
- Angular 19 no admite funciones flecha en plantillas; usar métodos del componente.
- No usar `.wrap` como clase de contenedor de página: choca con `row wrap`. Se usa `.page-wrap`.
- Chrome headless tiene ~500 px de ancho mínimo: capturas "de celular" a 412 px salen recortadas (no es un error de la página).
- Al enviar JSON con tildes desde curl en Git Bash, escapar como `\u00f1`; si no, el backend responde «No se pudo leer la solicitud».
