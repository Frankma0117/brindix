# Conectar las redes

Cada proyecto crea sus propias cuentas y apps (YouTube, Meta, TikTok) y pone las claves en su .env. La dirección de retorno de las tres es **<PUBLIC_URL>/api/publisher-oauth/callback**.

## Conectar YouTube (una vez por proyecto)
1. En Google Cloud: crea un proyecto, activa **YouTube Data API v3**, configura la pantalla de consentimiento (añade tu cuenta como usuario de prueba) y crea un cliente OAuth de tipo **Aplicación web**.
2. URI de redirección autorizada: `<PUBLIC_URL>/api/publisher-oauth/callback` .
3. En el `.env` del servidor: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y, si quieres, `YOUTUBE_PRIVACY` (por defecto `private`). Reinicia el servicio.
4. Panel → Publicador → Cuentas → YouTube → **Conectar con Google**.
5. Mientras la app no pase la auditoría de Google, YouTube deja los videos subidos como **privados** aunque se pida público. Pide la auditoría cuando quieras publicar abierto.
6. Cuota: cada subida gasta ~1600 unidades de las 10 000 diarias (unos 6 videos al día).
- La API de YouTube solo recibe videos: una imagen no se puede programar a YouTube (el panel avisa).
- Los tokens se renuevan solos con el refresh token.

## Conectar Instagram y Facebook (Meta)
1. Crea una **página de Facebook** y convierte tu Instagram en cuenta **profesional** (Empresa o Creador); vincúlala a esa página (Configuración de la página → Cuentas vinculadas).
2. En developers.facebook.com crea una app tipo **Empresa** y añade **Facebook Login for Business** (o Inicio de sesión con Facebook). En «URI de redireccionamiento OAuth válidos» pon `<PUBLIC_URL>/api/publisher-oauth/callback`.
3. Permisos que pide el panel: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`. En modo desarrollo funcionan con tus propias cuentas (agrégate como administrador o probador de la app); para cuentas de terceros hay que pasar la revisión de Meta.
4. `.env` del servidor: `META_APP_ID`, `META_APP_SECRET` (y `META_PAGE_ID` si administras varias páginas). Reinicia.
5. Panel → Cuentas → Instagram (o Facebook) → **Conectar con Meta**: una sola autorización conecta la página y su Instagram.
- Meta descarga el archivo desde la dirección pública: `PUBLIC_URL` debe ser https y alcanzable desde internet (en Canix ya lo es).
- Instagram: los videos salen como Reels y las imágenes como publicaciones (JPEG). El video puede tardar unos minutos en procesarse.
- El token de página no caduca; si Meta lo revoca (cambio de contraseña, etc.) el panel marca la red «Con error» y se vuelve a conectar.

## Conectar TikTok
1. En developers.tiktok.com crea una app, añade los productos **Login Kit** y **Content Posting API** (activa *Direct Post*) y registra la URI de redirección `<PUBLIC_URL>/api/publisher-oauth/callback`.
2. Scopes: `user.info.basic` y `video.publish`. En modo sandbox añade tu cuenta como usuario de prueba.
3. `.env` del servidor: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_PRIVACY` (por defecto `SELF_ONLY`). Reinicia.
4. Panel → Cuentas → TikTok → **Conectar con TikTok**.
- Hasta que TikTok audite la app, todo video se publica **privado** (solo tú). Pide la auditoría cuando quieras publicar abierto.
- Solo videos (MP4). Los tokens se renuevan solos.

