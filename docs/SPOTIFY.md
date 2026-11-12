# Música en Brindix: Spotify, YouTube o manual

Cada bar elige su música en **Panel del administrador → Configuración → Música**. Nada de esto
va en el `.env` del servidor: cada bar pone sus propias claves (se guardan cifradas).

| Modo | Qué hace | Qué necesita |
|---|---|---|
| ✋ Manual | El cliente escribe la canción; el administrador la pone en su reproductor y pulsa «Siguiente». | Nada |
| 🟢 Spotify | El cliente busca con carátula; Brindix manda la siguiente de la cola al Spotify del bar cuando a la actual le quedan ~25 s. | App de Spotify del bar + cuenta **Premium** |
| 🔴 YouTube | El cliente busca en YouTube; la **pantalla del TV** (enlace con llave) reproduce los videos en orden y avanza sola. | API key de YouTube Data API v3 |

## Spotify (paso a paso, una vez por bar)

1. Entra a <https://developer.spotify.com/dashboard> con la cuenta Premium del bar → **Create app**.
2. En **Redirect URI** pega exactamente la dirección que muestra Configuración → Música
   (en producción: `https://brindix.cania.app/api/spotify/callback`). Marca **Web API** y guarda.
3. Si la cuenta que se va a conectar no es la que creó la app, agrégala en **User Management**.
4. En **Settings** copia **Client ID** y **Client secret** → pégalos en Configuración → Música → Spotify → «Guardar datos».
5. Pulsa **Conectar Spotify**, acepta con la cuenta del bar y elige «Usar Spotify».
6. En el bar: deja Spotify abierto y sonando en el computador del bar (una playlist de fondo sirve).

Como cada bar usa **su propia app**, el límite de 25 usuarios del «modo desarrollo» de Spotify
no afecta a la plataforma (cada app solo conecta la cuenta de su bar).

## YouTube (paso a paso)

1. <https://console.cloud.google.com> → crea un proyecto → habilita **YouTube Data API v3**.
2. **Credenciales → Crear credenciales → Clave de API** (recomendado: restringirla a YouTube Data API v3).
3. Pégala en Configuración → Música → YouTube → «Guardar key» y elige «Usar YouTube».
4. Abre en el TV el enlace **con llave** de Configuración → Pantalla del TV y tócalo una vez para activar el sonido.

La cuota gratis da ~100 búsquedas al día por key; Brindix guarda 30 minutos las búsquedas repetidas.

## Problemas comunes

| Mensaje | Qué hacer |
|---|---|
| `INVALID_CLIENT: Invalid redirect URI` | La Redirect URI de la app no es idéntica a la que muestra Brindix. |
| «No hay un reproductor activo» | Abre Spotify en el computador del bar y dale play a algo. |
| «la cuenta debe ser Premium…» | La cuenta es Free o no está en User Management de la app. |
| «Se agotaron las búsquedas de YouTube por hoy» | Cuota diaria de la key agotada; vuelve mañana o usa otra key. |

## Uso comercial

Las cuentas personales de Spotify y YouTube son para uso personal y no comercial. Para música en
un negocio abierto al público consulten las licencias (en Colombia, comunicación pública con
SAYCO-ACINPRO) o un servicio de música comercial. La cola de Brindix no depende del reproductor,
así que se puede agregar otro proveedor con API.

## Código

- `music/SpotifyClient.java` (OAuth, búsqueda, cola, saltar), `SpotifyAccountService.java` (tokens cifrados por bar),
  `SpotifySyncJob.java` (cada 5 s), `YouTubeClient.java` (búsqueda + duración), `MusicService.java` (cola y reglas).
- Pantalla: `/api/public/{bar}/screen?key=` devuelve `player` (video a reproducir); `/screen/ended` avanza la cola.
