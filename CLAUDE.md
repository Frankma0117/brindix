# CLAUDE.md — Brindix

Plataforma para bares (multi-bar): carta QR, rondas, cobros por ronda o total, caja con cierre,
inventario con costos, música (Spotify/YouTube/manual), pantalla. Repo
`git@github.com:Frankma0117/brindix.git` (commit y push en cada avance). Responde siempre en español.

## Estado
- [x] 2026-11-11: fase 1 (un bar, PostgreSQL/H2) — reemplazada el mismo día.
- [x] 2026-11-11: **multi-bar + MySQL + perfiles + caja + cobros + Spaces + música por bar**. Prueba de
      punta a punta del backend (`smoke2`: 46 comprobaciones, incluye costo promedio, efectivo esperado,
      ganancia y diferencia de caja) y revisión visual con Chrome headless.
- [x] 2026-11-11: desplegado en `/opt/brindix` (Docker, MySQL 8.4, puerto 127.0.0.1:5710).
- [ ] `sudo bash /opt/brindix/scripts/sudo-setup.sh` (nginx + certbot de brindix.cania.app) — lo corre el usuario.
- [ ] Conectar Spotify/YouTube reales desde Configuración → Música (el código no se ha probado con cuentas reales).

## Decisiones del usuario
- Brindix es el servicio general; cada bar entra en `brindix.cania.app/<bar>` con su propio acceso.
- Solo el administrador modifica productos, precios, inventario, entradas de mercancía, caja y pedidos.
- El mesero solo ve la carta y carga productos a sus mesas; entrega y (opcional) cobra.
- En bares pequeños el administrador también es mesero: aparece como "Yo" en la lista de quién lleva,
  tiene "🙋 Yo lo llevo" en los pedidos del cliente, sus cobros entran directo a caja y al ingresar
  vuelve a la vista que usó por última vez (panel o mesas).
- Pedidos del cliente desde el QR son opcionales (los activa el administrador) y él los asigna a un mesero.
- Cobro por ronda o total; lo puede hacer el mesero (queda pendiente de entregar en caja) o el administrador.
- Toda cuenta con clave inicial (o puesta por otro) debe cambiarla al entrar: `must_change_password`,
  el filtro JWT responde 403 `PASSWORD_CHANGE_REQUIRED` a todo menos `/api/auth/me|password` y `/api/platform/password`.
- Modo soporte: el súper administrador entra a cualquier bar activo como su administrador
  (`POST /api/platform/venues/{id}/enter`, token `support` de 4 h, nombre "Soporte Brindix (…)" en la bitácora).
- Toda configuración de integraciones (Spotify, YouTube) va en Configuración del administrador, no en el .env.
- Imágenes en DigitalOcean Spaces (mismo bucket de Aula Interactiva, prefijo `brindix/`); imágenes de
  prueba generadas una sola vez con fal.ai (`scripts/seed-images.py`).

## Diseño: skills obligatorias
Todo trabajo de diseño sigue las skills instaladas en `~/.claude/skills`:
- **impeccable**: pantallas de trabajo (mesero, caja, admin, plataforma) = modo *Operate*; landing = *Persuade*.
  Leer `reference/craft-floor.md` antes de editar UI. Pendiente según esa guía: quitar las etiquetas sobre
  los títulos (kicker), el texto con degradado, los emoji usados como íconos (pasar a un solo set SVG) y las
  tarjetas de métricas genéricas.
- **design-taste-frontend** (taste): solo para la landing (tipo *software*): nada de violeta en la paleta
  propia, una sección por pantalla, sin animaciones al hacer scroll.
- **Emil Kowalski** (emil-design-eng, animate, review-animations…): movimiento < 300 ms con ease-out fuerte,
  `:active` scale(.97), hover solo con `(hover: hover) and (pointer: fine)`.

## Tema claro / oscuro
- `core/theme.ts`: Automático (sigue al dispositivo) → Claro → Oscuro; se guarda en `brindix.theme`; `index.html`
  aplica `<html data-mode>` antes de Angular. La pantalla del TV es siempre oscura (`.force-dark`).
- Nada de colores fijos para fondos o textos: usar `--glass`, `--scrim`, `--hover`, `--ink-*` (texto sobre
  fondo de color suave) y `--c-*` (acento como color de texto). Revisar ambos modos con capturas.

## Trampas conocidas
- Node 18 es el predeterminado del PC; Angular necesita Node 20: `C:\Users\Asus\node20`.
- Spring Data no detecta repositorios anidados en otra clase: un archivo por repositorio.
- Enums usados en JPQL deben ser de nivel superior.
- MySQL ignora `REFERENCES` en la columna: las FK van como `CONSTRAINT ... FOREIGN KEY` de tabla.
- `Map.of().get(null)` lanza NPE: usar `HashMap` si la clave puede ser nula.
- Angular 19: nada de funciones flecha ni objetos indexados (`{...}[x]`) en plantillas; usar métodos.
- No usar `.wrap` ni `.glow` como clases de contenedor/decoración propias: chocan con `row wrap` y `card glow`.
- Heredocs largos en Bash fallan aquí: escribir archivos con la herramienta Write o con un script.
- Chrome headless tiene ~500 px de ancho mínimo: capturas "de celular" a menos salen recortadas.
- JSON con tildes desde curl en Git Bash: escapar como `\u00f1`.
