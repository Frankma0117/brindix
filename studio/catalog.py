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

# Las mismas voces en español de Fish Audio que usa Canix (mismos ids). "gender" solo sirve para filtrar en el panel.
VOICES = [
    {"key": "H1", "gender": "male", "name": "Mateo", "style": "cálido y enérgico", "id": "b46654f2e3ef4f48b5f7c9d22ae3f921"},
    {"key": "H2", "gender": "male", "name": "Andrés", "style": "relajado y suave", "id": "c943469bcc194734ac1a09d083cb1062"},
    {"key": "H3", "gender": "male", "name": "Santiago", "style": "bogotano, calmado y claro", "id": "e3ce51cfea59447b8ce2c63b3b681e31"},
    {"key": "H4", "gender": "male", "name": "Camilo", "style": "sereno, de narrador", "id": "da13e1b3f87c4f40b8090d0fd6454921"},
    {"key": "H5", "gender": "male", "name": "Pedro", "style": "neutro", "id": "17ed67335f0145c9a850fddecd3c40e0"},
    {"key": "H6", "gender": "male", "name": "Julián", "style": "claro y seguro, de asistente", "id": "de3042eb048a4d37baf2e61d10183e23"},
    {"key": "H7", "gender": "male", "name": "Nicolás", "style": "joven, claro y profesional", "id": "c7a15a61f379424ca773a8eda073fdf0"},
    {"key": "H8", "gender": "male", "name": "Sebastián", "style": "juvenil y amigable", "id": "b861ebdd5bfc4e4ca1d8dc967bc56eac"},
    {"key": "H9", "gender": "male", "name": "Felipe", "style": "conversacional y animado", "id": "4aa3bdb4a90449dfbd7aba351b288858"},
    {"key": "H10", "gender": "male", "name": "Tomás", "style": "grave, cálido y pausado", "id": "51aead15fd23476291a10b5ccf7ab8fb"},
    {"key": "H11", "gender": "male", "name": "Rodrigo", "style": "locutor grave y profesional", "id": "3f45a7fd7a614655a61eb7027b955783"},
    {"key": "H12", "gender": "male", "name": "Ricardo", "style": "locutor publicitario, seguro", "id": "a1fe2e1b6f324e27929d5088f2d09be3"},
    {"key": "H13", "gender": "male", "name": "Néstor", "style": "locutor profundo, de anuncio", "id": "def180b161a3498db94025d5124fcb2a"},
    {"key": "H14", "gender": "male", "name": "Adrián", "style": "narrador de historias, cercano", "id": "9deec9a061894a93a133d2bf45d2e4c0"},
    {"key": "H15", "gender": "male", "name": "Javier", "style": "mexicano, narrador claro", "id": "b0e04de04f6e4ace8deee82fa6d121e5"},
    {"key": "H16", "gender": "male", "name": "Esteban", "style": "enérgico, de publicidad", "id": "9a831a5fafd04c9aab68d248a32fa5b2"},
    {"key": "M1", "gender": "female", "name": "Valentina", "style": "joven y amigable", "id": "08ecaf85075041fc9aa66698ae430dc4"},
    {"key": "M2", "gender": "female", "name": "Camila", "style": "conversacional y expresiva", "id": "84a980d0ef3d4f8ea185951bd920afbe"},
    {"key": "M3", "gender": "female", "name": "Laura", "style": "clara y profesional", "id": "f186d3dafbd244eca689a212b5ba0269"},
    {"key": "M4", "gender": "female", "name": "Daniela", "style": "paisa, suave y cercana", "id": "10509ddabaaf48089ad5cf2d1b1eaf1d"},
    {"key": "M5", "gender": "female", "name": "Sofía", "style": "cálida, de narradora", "id": "e296306da5d449999f6e35c2b9f60aea"},
    {"key": "M6", "gender": "female", "name": "Isabela", "style": "clara y segura, de asistente", "id": "fb9d5855f185451983404deb10788ad4"},
    {"key": "M7", "gender": "female", "name": "Mariana", "style": "calmada y pausada", "id": "f95998e46fdb4bd4aefe591c312b72a4"},
    {"key": "M8", "gender": "female", "name": "Gabriela", "style": "clara y cálida", "id": "c5db0dd415bd4521a5c3c36372a4c464"},
    {"key": "M9", "gender": "female", "name": "Paula", "style": "paisa, expresiva y amigable", "id": "e8ffb4ccb56a4eb0b1d85b57f2f45a47"},
    {"key": "M10", "gender": "female", "name": "Juliana", "style": "enérgica y profesional", "id": "14909251a5064426ab1ae84cdbb4aeac"},
    {"key": "M11", "gender": "female", "name": "Natalia", "style": "joven, educativa y cercana", "id": "35929683c49c4ec0bf779dc07d22620b"},
    {"key": "M12", "gender": "female", "name": "Carolina", "style": "narradora de voz profunda", "id": "bfed5c0810a347dbb62e8ccce7f59c48"},
    {"key": "M13", "gender": "female", "name": "Alejandra", "style": "profesional, de publicidad", "id": "70fb19852a484f3eb1d040423e2a8be7"},
    {"key": "M14", "gender": "female", "name": "Fernanda", "style": "mexicana, educativa y clara", "id": "b806a84350454df0af0b86f930f36915"},
]

# Estilos de música de fondo: cada uno se genera una sola vez con fal.ai y queda guardado en Spaces.
MUSIC = {
    "fiesta": "upbeat latin pop instrumental for a bar commercial, energetic, modern, no vocals",
    "lounge": "chill lounge house instrumental, warm night bar atmosphere, smooth, no vocals",
    "salsa": "lively salsa instrumental with brass and congas, danceable and festive, no vocals",
    "vallenato": "cheerful vallenato instrumental with accordion and caja, Colombian, warm, no vocals",
    "reggaeton": "modern reggaeton instrumental beat, dembow rhythm, catchy synth, party, no vocals",
    "tropical": "tropical cumbia instrumental with guacharaca and bass, sunny and festive, no vocals",
    "rock": "energetic classic rock instrumental with electric guitars and drums, bar vibe, no vocals",
    "jazz": "smooth jazz instrumental with piano, double bass and brushed drums, late-night bar, no vocals",
    "acustico": "warm acoustic guitar instrumental, friendly and relaxed, light percussion, no vocals",
    "electronica": "modern electronic dance instrumental, driving house beat, club energy, no vocals",
    "romantico": "romantic latin ballad instrumental with soft piano and strings, intimate, no vocals",
    "urbano": "urban hip hop instrumental beat with deep bass and crisp snares, confident, no vocals",
    "ninguna": None,
}
