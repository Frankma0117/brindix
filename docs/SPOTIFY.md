# Conectar Spotify a Brindix

Brindix funciona sin Spotify: en **modo manual** los clientes escriben la canción, el
administrador ordena la cola y pulsa «Siguiente» mientras la pone en su reproductor. Con
Spotify conectado, Brindix busca canciones con carátula y **manda solo la siguiente a la cola
del reproductor** cuando la actual está por terminar, y lee lo que suena para la pantalla.

## Antes de empezar: lo que hay que saber

1. **Cuenta Premium.** Spotify solo deja controlar la cola (agregar, saltar, pausar) desde
   cuentas Premium.
2. **Uso comercial.** Las cuentas normales de Spotify (Free, Premium, Familiar) son *para uso
   personal y no comercial* según los términos de Spotify. Poner música en un bar abierto al
   público con ellas no está permitido, y además en Colombia el bar debe pagar los derechos de
   comunicación pública (OSA: SAYCO-ACINPRO). Opciones legales: una plataforma de música
   comercial para negocios (por ejemplo Soundtrack Your Brand) o música con licencia. La cola
   de Brindix no depende del reproductor: el modo manual sirve con cualquiera, y se puede
   escribir un conector para otro servicio con API.
3. **Modo desarrollo.** Una app nueva de Spotify queda en «Development mode»: solo la usan
   las cuentas que agregues en *User Management* (hasta 25). Para un bar basta con la cuenta
   del bar. Spotify cambia estas reglas de vez en cuando: revisa el dashboard al crear la app.

## Paso a paso (una sola vez)

1. Entra a <https://developer.spotify.com/dashboard> con la cuenta del bar y acepta los términos.
2. **Create app**:
   - *App name*: `Brindix <nombre del bar>`
   - *App description*: `Cola de música del bar`
   - *Redirect URI*: **exactamente** la de tu instalación, sin barra final:
     - En el computador (pruebas): `http://127.0.0.1:8080/api/spotify/callback`
       (Spotify ya no acepta `localhost`; usa `127.0.0.1`).
     - En el servidor: `https://TU-DOMINIO/api/spotify/callback` (debe ser `https`).
   - En *Which API/SDKs are you planning to use?* marca **Web API**.
3. Guarda. En **Settings** copia el **Client ID** y, con «View client secret», el **Client secret**.
4. En *User Management* agrega el correo de la cuenta del bar si es distinta a la que creó la app.
5. Pon los datos en el `.env` del backend y reinicia Brindix:

   ```env
   SPOTIFY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback
   SPOTIFY_MARKET=CO
   BRINDIX_PUBLIC_URL=http://localhost:4200
   ```

   `SPOTIFY_REDIRECT_URI` debe ser idéntica a la del paso 2. `BRINDIX_PUBLIC_URL` es a dónde
   vuelve el navegador después de conectar (la dirección del panel).
6. En Brindix entra como administrador → **Música** → **Conectar Spotify**, acepta los permisos
   con la cuenta del bar y listo: el panel dice «Conectado como …».

## Uso diario

- Abre Spotify (app de escritorio o web) **en el computador del bar** y pon a sonar algo
  (una playlist de fondo sirve). Sin un reproductor activo, Spotify no acepta canciones en la cola.
- Los clientes buscan y piden desde el QR; tú ordenas la cola en **Música**.
- Cuando a la canción actual le quedan ~25 segundos, Brindix manda la primera de la cola a
  Spotify (en la lista aparece «En Spotify»: desde ese momento ya no se puede reordenar).
- «Siguiente de la lista» manda la siguiente y salta de inmediato.
- Si la playlist de fondo suena porque la cola está vacía, la pantalla igual muestra esa canción.

## Problemas comunes

| Mensaje | Qué hacer |
|---|---|
| `INVALID_CLIENT: Invalid redirect URI` | La Redirect URI del dashboard y `SPOTIFY_REDIRECT_URI` no son idénticas. |
| «No hay un reproductor activo» | Abre Spotify en el computador del bar y dale play a algo. |
| «la cuenta del bar debe ser Premium» | La cuenta conectada es Free. |
| «La conexión con Spotify venció» | Se revocó el acceso desde Spotify: vuelve a «Conectar Spotify». |
| La búsqueda no devuelve nada | Revisa Client ID/Secret y reinicia el backend. |

## Cómo está hecho (para quien mantenga el código)

- `music/SpotifyClient.java`: llamadas HTTP (OAuth Authorization Code, búsqueda, cola, saltar).
  Para buscar sin cuenta conectada usa un token *client credentials*.
- `music/SpotifyAccountService.java`: guarda `refresh_token` en `venues` y renueva el acceso.
- `music/SpotifySyncJob.java`: cada 5 s lee `currently-playing`, marca la solicitud como sonando o
  sonada y envía la siguiente cuando falta poco (`MusicService.syncSpotify`).
- Permisos pedidos: `user-read-playback-state user-modify-playback-state user-read-currently-playing`.
