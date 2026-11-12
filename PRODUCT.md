# Brindix — producto

**Qué es:** software para bares y gastrobares en Colombia (servicio multi-bar en `brindix.cania.app/<bar>`).
Carta con QR por mesa, rondas por tandas desde el celular del mesero, pedidos del cliente (opcional),
cobro por ronda o total, caja con cierre del día, inventario con costos, música a pedido (Spotify,
YouTube o manual) y pantalla del TV con publicidad.

**Quién lo usa y dónde**
- **Mesero:** celular en una mano, de noche, con poca luz y ruido. Necesita rapidez: tocar y enviar.
- **Administrador:** dueño o encargado; en bares pequeños también atiende mesas. Usa celular y computador.
- **Cliente:** escanea el QR en la mesa, sin registrarse.
- **TV:** pantalla del bar, se ve de lejos.
- **Súper administrador (dueño de Brindix):** crea bares y entra en modo soporte.

**Superficies y modo (impeccable)**
- Landing `/` → *Persuade* (taste: tipo *software*).
- Mesero, caja, administrador, plataforma → *Operate*.
- Carta del cliente → *Operate* con marca del bar (fotos, recomendados).
- Pantalla del TV → *Experience* (siempre oscura).

**Bar de demostración:** «Candela Brava» (`/candela-brava`), bar de barrio en Chapinero, Bogotá.
Marca inventada (no existe un bar con ese nombre en Bogotá). Carta con productos y precios reales de
Bogotá 2026 y fotos de Wikimedia Commons (créditos en `/creditos`). Se crea con `scripts/seed-demo.mjs`.

**Reglas del usuario**
- Solo el administrador cambia precios, inventario y entradas de mercancía.
- Cada cuenta con clave temporal debe cambiarla al entrar.
- Todo lo de integraciones va en Configuración del administrador.
- Diseño siempre con las skills impeccable, design-taste-frontend y las de Emil Kowalski.
