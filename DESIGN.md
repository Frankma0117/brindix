# Brindix — sistema de diseño

Fuente de verdad: `frontend/src/styles.scss` (tokens) y `frontend/src/app/shared/icon.component.ts` (íconos).

## Mundo
Barra de noche. Negro cálido, ámbar de trago y coral de neón. **Nada de violeta ni de fondo crema.**
Oscuro por defecto (se usa con poca luz); modo claro neutro opcional (botón Automático → Claro → Oscuro).

## Color (tokens)
| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` / `--bg-2` | #0f0d0b / #15120f | #f3f3f1 / #ebebe8 | fondo / segunda capa (barras laterales, secciones alternas) |
| `--surface` 1–3 | #1c1814 → #302922 | #fff → #e7e6e2 | tarjetas, botones, hover |
| `--text` / `--muted` / `--faint` | #f7f1ea / #b5a99b / #8c8174 | #1a1714 / #59524b / #6e665e | texto (contraste ≥ 4.5:1) |
| `--amber` | #ffb238 | — | acento principal, selección actual, foco |
| `--pink` | #ff5c6c | — | coral: alertas de pedido, degradado de marca |
| `--grad` | ámbar → coral | — | solo botón primario y contadores |
| `--c-*`, `--ink-*` | — | versiones oscuras | acento usado como texto / sobre fondo suave |

Estados: verde = entregado/cobrado, coral = pendiente/atención, ámbar = advertencia/caja, rojo = error.

## Tipografía
- **Manrope** en todas las pantallas de trabajo (títulos incluidos), escala fija: 28 / 21 / 16.5 / 15 / 13 / 11.5.
- **Bricolage Grotesque** solo en la landing, la carta del cliente (nombre del bar, precios grandes) y el TV.
- Cifras con `tabular-nums` y sin saltos de línea (`.num`).

## Íconos
Lucide (ISC) mediante `<bx-icon name="…">`; trazo 1.9, heredan el color del texto. Nada de emoji como
íconos. Para agregar uno: sumar el nombre en `frontend/scripts/build-icons.mjs` y correrlo.

## Movimiento (Emil Kowalski)
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; UI < 300 ms; botones `:active` scale(.97).
- Hover solo con `@media (hover: hover) and (pointer: fine)`.
- Nada de animación en acciones repetidas (sumar productos); la landing tiene una sola entrada del hero.
- `prefers-reduced-motion` respetado.

## Componentes y patrones
- Cifras agrupadas = una franja con divisiones (`.grid` con `.card.stat`), no tarjetas sueltas.
- Prohibido: etiquetas pequeñas sobre los títulos (kicker), texto con degradado, borde lateral de color > 1 px,
  vidrio/blur decorativo, cuadrícula de tarjetas «ícono + título + texto».
- Cabeceras y barras pegadas: fondo sólido `--glass`.
- Mesero: filas de producto (tocar = +1), tandas 1·2·3·6·12, barra fija «Enviar pedido» (ver `product-picker`).

## Landing (taste, tipo software)
Una sección por pantalla, hero con la interfaz real del producto, fotos reales con créditos en `/creditos`,
sin íconos decorativos ni animaciones al hacer scroll.
