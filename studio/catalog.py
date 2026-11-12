"""Lo que el estudio sabe de Brindix: funciones reales, pantallas que se pueden mostrar y tipos de video.

Todo guion (de la IA o de plantilla) solo puede usar estas pantallas y hablar de estas funciones.
"""

# Pantallas reales del bar de demostración. device: phone (celular), laptop (computador) o tv.
SHOTS = {
    "landing": {"device": "laptop", "label": "La página de Brindix"},
    "carta": {"device": "phone", "label": "La carta con QR que ve el cliente"},
    "musica": {"device": "phone", "label": "El cliente pide su canción"},
    "mesas": {"device": "phone", "label": "El tablero de mesas del mesero"},
    "pedido": {"device": "phone", "label": "El mesero carga una ronda en dos toques"},
    "cuenta": {"device": "phone", "label": "La cuenta de una mesa y el cobro"},
    "resumen": {"device": "laptop", "label": "El resumen del administrador"},
    "caja": {"device": "laptop", "label": "La caja y el cierre del día"},
    "carta_admin": {"device": "laptop", "label": "La carta con precio, costo y ganancia"},
    "inventario": {"device": "laptop", "label": "El inventario"},
    "pantalla": {"device": "tv", "label": "La pantalla del TV: lo que suena y la publicidad"},
}

FEATURES = """
Brindix es un software para bares y gastrobares de Colombia. Funciones reales (no inventes otras):
- Carta digital con QR en cada mesa, con fotos, categorías y recomendados; el cliente no se registra ni instala nada.
- El cliente puede pedir desde el QR (si el bar lo activa), llamar al mesero y pedir la cuenta.
- Rondas por tandas: el mesero toca el producto y elige 2, 3, 6 o 12; seis cervezas en dos toques. Notas por producto.
- Tablero de mesas en el celular del mesero: libres, ocupadas, lo que debe cada una. Avisos con sonido cuando llaman.
- Cobro por ronda o la cuenta completa, en efectivo, Nequi, Daviplata, tarjeta o transferencia. Propina.
- Caja con cierre del día: base, recibos y compras pagados de la caja, efectivo esperado y diferencia exacta.
- Precio de venta y costo en cada producto; ganancia y margen; inventario con costo promedio.
- Música a pedido: los clientes buscan su canción en Spotify o YouTube desde la mesa; el administrador ordena la lista.
- Pantalla del TV: lo que suena, lo que sigue y banners de promociones con foto y precio.
- Perfiles: administrador (todo), mesero (sus mesas), cliente (sin registro). Bitácora de cambios.
- Funciona en el navegador del celular, la tablet o el computador. Página: brindix.cania.app
"""

# Tipos de video: qué pantallas usa la plantilla de respaldo y de qué trata.
KINDS = {
    "anuncio": {"name": "Anuncio (publicidad)", "seconds": 35,
                "about": "Un anuncio corto para redes que convence a dueños de bares de pedir una demo.",
                "shots": ["carta", "pedido", "caja", "pantalla"]},
    "tutorial_cliente": {"name": "Tutorial: el cliente", "seconds": 50,
                         "about": "Cómo el cliente usa el QR: ve la carta, pide, pone su canción y pide la cuenta.",
                         "shots": ["carta", "musica", "cuenta"]},
    "tutorial_mesero": {"name": "Tutorial: el mesero", "seconds": 55,
                        "about": "Cómo el mesero ve sus mesas, carga rondas por tandas, entrega y cobra.",
                        "shots": ["mesas", "pedido", "cuenta"]},
    "tutorial_admin": {"name": "Tutorial: el administrador", "seconds": 60,
                       "about": "Qué ve el administrador: resumen, carta con costos, inventario y caja.",
                       "shots": ["resumen", "carta_admin", "inventario", "caja"]},
    "tutorial_caja": {"name": "Tutorial: caja y cierre", "seconds": 50,
                      "about": "Cómo se abre la caja, se registran salidas y se cierra con la diferencia exacta.",
                      "shots": ["caja", "resumen"]},
    "tutorial_musica": {"name": "Tutorial: música y pantalla", "seconds": 45,
                        "about": "Cómo los clientes piden canciones y el TV muestra lo que suena y las promos.",
                        "shots": ["musica", "pantalla"]},
    "funcion": {"name": "Una función", "seconds": 30,
                "about": "Un video corto sobre una sola función que pida la idea.",
                "shots": ["carta"]},
}

FORMATS = {"vertical": (1080, 1920), "horizontal": (1920, 1080), "cuadrado": (1080, 1080)}

VOICES = [
    {"key": "H3", "name": "Santiago", "style": "bogotano, calmado y claro", "id": "e3ce51cfea59447b8ce2c63b3b681e31"},
    {"key": "H1", "name": "Mateo", "style": "cálido y enérgico", "id": "b46654f2e3ef4f48b5f7c9d22ae3f921"},
    {"key": "H9", "name": "Felipe", "style": "conversacional y animado", "id": "4aa3bdb4a90449dfbd7aba351b288858"},
    {"key": "H7", "name": "Nicolás", "style": "joven, claro y profesional", "id": "c7a15a61f379424ca773a8eda073fdf0"},
    {"key": "M1", "name": "Valentina", "style": "joven y amigable", "id": "08ecaf85075041fc9aa66698ae430dc4"},
    {"key": "M2", "name": "Camila", "style": "conversacional y expresiva", "id": "84a980d0ef3d4f8ea185951bd920afbe"},
    {"key": "M4", "name": "Daniela", "style": "paisa, suave y cercana", "id": "10509ddabaaf48089ad5cf2d1b1eaf1d"},
    {"key": "M5", "name": "Sofía", "style": "cálida, de narradora", "id": "e296306da5d449999f6e35c2b9f60aea"},
]

MUSIC = {
    "fiesta": "upbeat latin pop instrumental for a bar commercial, energetic, modern, no vocals",
    "lounge": "chill lounge house instrumental, warm night bar atmosphere, smooth, no vocals",
    "ninguna": None,
}
