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
    {"key": "H11", "gender": "male", "name": "Rodrigo", "style": "locutor grave y profesional", "id": "3f45a7fd7a614655a61eb7027b955783"},
    {"key": "H12", "gender": "male", "name": "Ricardo", "style": "locutor publicitario, seguro", "id": "a1fe2e1b6f324e27929d5088f2d09be3"},
    {"key": "H13", "gender": "male", "name": "Néstor", "style": "locutor profundo, de anuncio", "id": "def180b161a3498db94025d5124fcb2a"},
    {"key": "H14", "gender": "male", "name": "Adrián", "style": "narrador de historias, cercano", "id": "9deec9a061894a93a133d2bf45d2e4c0"},
    {"key": "H15", "gender": "male", "name": "Javier", "style": "mexicano, narrador claro", "id": "b0e04de04f6e4ace8deee82fa6d121e5"},
    {"key": "H16", "gender": "male", "name": "Esteban", "style": "enérgico, de publicidad", "id": "9a831a5fafd04c9aab68d248a32fa5b2"},
    {"key": "M11", "gender": "female", "name": "Natalia", "style": "joven, educativa y cercana", "id": "35929683c49c4ec0bf779dc07d22620b"},
    {"key": "M12", "gender": "female", "name": "Carolina", "style": "narradora de voz profunda", "id": "bfed5c0810a347dbb62e8ccce7f59c48"},
    {"key": "M13", "gender": "female", "name": "Alejandra", "style": "profesional, de publicidad", "id": "70fb19852a484f3eb1d040423e2a8be7"},
    {"key": "M14", "gender": "female", "name": "Fernanda", "style": "mexicana, educativa y clara", "id": "b806a84350454df0af0b86f930f36915"},
    {"key": "M15", "gender": "female", "name": "Ximena", "style": "mexicana, cálida y conversacional", "id": "561fe660218349598b7570bab1c8148b"},
    {"key": "M16", "gender": "female", "name": "Catalina", "style": "colombiana, enérgica, de anuncio", "id": "0051425f78064482b3a75146feec8651"},
    {"key": "H17", "gender": "male", "name": "Emilio", "style": "narrador solemne y sereno", "id": "8d2c17a9b26d4d83888ea67a1ee565b2"},
    {"key": "H18", "gender": "male", "name": "Bruno", "style": "enérgico, de redes sociales", "id": "a335d470fff248e8890dce6550a2874b"},
    {"key": "H19", "gender": "male", "name": "Joaquín", "style": "narrador sereno y amable", "id": "f53102becdf94a51af6d64010bc658f2"},
    {"key": "H20", "gender": "male", "name": "Ignacio", "style": "sabio y cálido, educativo", "id": "60a33602dacc4d899cb671b024e66d8c"},
    {"key": "H21", "gender": "male", "name": "Martín", "style": "grave, pausado y elegante", "id": "dc0746cd45dd40deb6bca32dc87fd7f5"},
    {"key": "H22", "gender": "male", "name": "Gonzalo", "style": "publicitario de voz profunda", "id": "d6cc48df129d45b18d5fe1afb76c1a92"},
    {"key": "H23", "gender": "male", "name": "Diego", "style": "conversacional, de redes", "id": "3399c2a4aa4e470b8adaaa2e4842ec12"},
    {"key": "H24", "gender": "male", "name": "Hernán", "style": "cuentacuentos expresivo", "id": "9be3e6c74a084848a47f3778cffeaed2"},
    {"key": "H25", "gender": "male", "name": "Álvaro", "style": "documental y profesional", "id": "ac594943984a47e7a827416eb263c7b1"},
    {"key": "H26", "gender": "male", "name": "Marcos", "style": "documental y claro", "id": "93dc4e3a1a494d58ad0f50f712b8b152"},
    {"key": "H27", "gender": "male", "name": "Gaspar", "style": "grave, amigable y expresivo", "id": "3e41879b20a74cdca139a0e0a7d31d2c"},
    {"key": "H28", "gender": "male", "name": "Raúl", "style": "de noticiero, serio", "id": "05100dcc9dfd4af49ea96dc5affbe5b1"},
    {"key": "H29", "gender": "male", "name": "Lucas", "style": "argentino, claro y seguro", "id": "f2a8c8e905d242859e8a3de2db575bef"},
    {"key": "H30", "gender": "male", "name": "Matías", "style": "chileno, seguro y enérgico", "id": "7dd2ab68aced4969a162069d435cf744"},
    {"key": "M17", "gender": "female", "name": "Valeria", "style": "amigable y luminosa", "id": "c11e80c135c3432a95d54519f43a2519"},
    {"key": "M18", "gender": "female", "name": "Renata", "style": "alegre y conversacional", "id": "286d076a6477415b8658499110a3ae13"},
    {"key": "M19", "gender": "female", "name": "Susana", "style": "suave, calmada y clara", "id": "a644b18dd74d4bc9a775398069fa459d"},
    {"key": "M20", "gender": "female", "name": "Andrea", "style": "cálida y amigable", "id": "d516b7839eb74f4da0bb1677e94127d0"},
    {"key": "M21", "gender": "female", "name": "Celia", "style": "entusiasta y enérgica", "id": "744589ecce9e4364ae8edc8c48111352"},
    {"key": "M22", "gender": "female", "name": "Inés", "style": "íntima y suave", "id": "b6d5c6fb554b4b23a80f384e0b08700a"},
    {"key": "M23", "gender": "female", "name": "Carmen", "style": "profesional y segura", "id": "3f065d660212478a9c697fa965b4d098"},
    {"key": "M24", "gender": "female", "name": "Verónica", "style": "locutora suave y profesional", "id": "a1070fc5bc824bb79dfa0007c00dfd0f"},
    {"key": "M25", "gender": "female", "name": "Lucía", "style": "publicitaria y enérgica", "id": "5e816f5a0658460b960881a24733c418"},
    {"key": "M26", "gender": "female", "name": "Antonia", "style": "dulce y cálida", "id": "779cbebcb4c04e74b73080a44bc98358"},
    {"key": "M27", "gender": "female", "name": "Elena", "style": "natural y profunda, narradora", "id": "edbe850c6b7d40f195edd8c043b18748"},
    {"key": "M28", "gender": "female", "name": "Rosa", "style": "suave y cercana", "id": "eaadef28d69a4a10b80436d28634115c"},
    {"key": "M29", "gender": "female", "name": "Lorena", "style": "educativa y animada", "id": "48bf0ac7af8b4c4ebb9d894301dcc5ae"},
    {"key": "M30", "gender": "female", "name": "Manuela", "style": "juvenil y cálida", "id": "8ab964fc63cd49a498f862333cb5b18f"},
    {"key": "M31", "gender": "female", "name": "Pilar", "style": "colombiana, dulce y tranquila", "id": "601f09c4607f4c4da5b3486b28346e04"},
    {"key": "M32", "gender": "female", "name": "Luisa", "style": "paisa, alegre y conversadora", "id": "f188d9cdf8ef4b58bef6b2f791ba049d"},
    {"key": "M33", "gender": "female", "name": "Guadalupe", "style": "mexicana, locutora profesional y segura", "id": "fc67d827e8384a2a9ca13bf0b0162b2a"},
    {"key": "M34", "gender": "female", "name": "Regina", "style": "mexicana, ágil y amigable", "id": "795ec40a01914c95b2b1b5c93d646d6e"},
    {"key": "M35", "gender": "female", "name": "Mariela", "style": "venezolana, profesional y amable", "id": "22550e2d849b44e18c7df57f61e666f9"},
    {"key": "M36", "gender": "female", "name": "Florencia", "style": "argentina, cálida y relajada", "id": "55589185654d4d5abc1035280611fb65"},
    {"key": "M37", "gender": "female", "name": "Agustina", "style": "argentina, joven, clara y amable", "id": "e5c2cf742d864a288e63a97774b727e4"},
    {"key": "M38", "gender": "female", "name": "Javiera", "style": "chilena, alegre y cálida", "id": "dfd23dbaf3a04dd2b358d3ab44ecf15f"},
    {"key": "M39", "gender": "female", "name": "Amparo", "style": "de abuela, cálida y maternal", "id": "69b15625e49546f8a3f465d31610f0bc"},
    {"key": "H31", "gender": "male", "name": "Ramiro", "style": "narrador latino, calmado", "id": "a508e76ec74e4b57ad77d907992a536e"},
    {"key": "H32", "gender": "male", "name": "Óscar", "style": "de profesor, calmado y claro", "id": "785d81f7fff943849fc0f077212f7cbd"},
    {"key": "H33", "gender": "male", "name": "Ernesto", "style": "narrador de cuentos, grave y cálido", "id": "0f1c18ccc09541c398c2f28f9516c78d"},
    {"key": "H34", "gender": "male", "name": "Fabián", "style": "narrador documental, sereno", "id": "8b7187104e32481bb675f0cca0b0a002"},
    {"key": "H35", "gender": "male", "name": "Daniel", "style": "joven, casual y animado", "id": "d1f70e33cb26469195a5a113e336c202"},
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
    "bachata": "romantic bachata instrumental with requinto guitar and bongos, warm night bar, no vocals",
    "merengue": "fast festive merengue instrumental with accordion, tambora and guira, party, no vocals",
    "champeta": "upbeat champeta instrumental with african guitar riffs and heavy bass, Caribbean party, no vocals",
    "lofi": "chill lo-fi hip hop instrumental, mellow keys, vinyl crackle, relaxed bar afternoon, no vocals",
    "funk": "groovy funk instrumental with slap bass, wah guitar and tight drums, fun and confident, no vocals",
    "bolero": "classic romantic bolero instrumental with nylon guitar and soft percussion, nostalgic bar, no vocals",
    "ninguna": None,
}
