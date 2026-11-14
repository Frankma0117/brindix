# El publicador dentro del panel de un proyecto (modo incrustado)

El publicador corre junto al proyecto (un contenedor más en su `docker-compose`) y se usa como **una sección más de su panel**: sin subdominio aparte y sin otro login. Los videos que el proyecto genera llegan a **«Por validar»** y el administrador elige cuál se publica.

```
navegador ──► nginx del proyecto ──┬─► el proyecto (/…)
                                    └─► publisher (/publicador/…)   ← EMBEDDED=true, BASE_PATH=/publicador
```

## 1. Variables (`.env` del publicador)
```
EMBEDDED=true
EMBED_SECRET=<texto largo al azar, el mismo que usa el proyecto para firmar los tickets>
BASE_PATH=/publicador
PUBLIC_URL=https://<dominio-del-proyecto>          # sin la ruta: la app añade BASE_PATH
EMBED_RETURN_URL=https://<dominio-del-proyecto>/<panel>   # a dónde vuelve «Volver al panel»
PROJECT_NAME=<Proyecto>
PROJECT_WEBHOOK_URL=                               # opcional: el proyecto se entera de lo que validas
PUBLISHER_API_KEY=<llave larga>                    # el proyecto envía sus videos con ella
```

## 2. nginx del proyecto
```nginx
location /publicador/ {
    proxy_pass http://publisher:3100;      # sin barra final: conserva la ruta completa
    client_max_body_size 320m;             # subir videos
    proxy_read_timeout 300s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
(Si nginx usa un resolver de Docker, usa una variable: `set $pub http://publisher:3100; proxy_pass $pub;`).
Los archivos que descargan Meta y TikTok salen de `PUBLIC_URL + /publicador/files/…`: tienen que ser públicos.

## 3. Entrar desde el panel del proyecto (ticket)
El backend del proyecto, **ya autenticado como administrador**, crea un ticket y manda al navegador a `/publicador/sso?ticket=<ticket>`. El publicador lo canjea por su cookie de sesión (httpOnly, 12 h) y redirige al panel.

```
payload = base64url( {"exp": <segundos unix>, "n": "<aleatorio de 12+ bytes en hex>"} )
ticket  = payload + "." + hex( HMAC_SHA256( EMBED_SECRET, payload ) )
```
Un solo uso; `exp` máximo 10 minutos hacia adelante (recomendado 60 s). Si el ticket es inválido o vencido se muestra «Enlace vencido» con el botón de volver.

**TypeScript / Node**
```ts
import { createHmac, randomBytes } from 'node:crypto';
export function publisherTicket(secret: string, ttlSec = 60): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSec, n: randomBytes(12).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
}
```
**Java (Spring Boot)**
```java
static String publisherTicket(String secret, long ttlSec) throws Exception {
  byte[] n = new byte[12]; new java.security.SecureRandom().nextBytes(n);
  String json = "{\"exp\":" + (System.currentTimeMillis() / 1000 + ttlSec) + ",\"n\":\"" + java.util.HexFormat.of().formatHex(n) + "\"}";
  String payload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
  mac.init(new javax.crypto.spec.SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
  return payload + "." + java.util.HexFormat.of().formatHex(mac.doFinal(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
}
```
La ruta del proyecto que emite el ticket debe exigir la sesión del administrador (y solo de él).

## 4. Enviar los videos que el proyecto genera («Por validar»)
`POST <publisher>/api/v1/assets` con `Authorization: Bearer <PUBLISHER_API_KEY>` (desde el servidor del proyecto, por la red interna: `http://publisher:3100/publicador/api/v1/assets`).
```json
{ "url": "https://…/video.mp4", "title": "Cómo preparar un mojito", "caption": "Texto sugerido", "ref": "video-123", "thumbnailUrl": "https://…/portada.jpg", "status": "pending" }
```
- Se descarga el archivo (https, nunca direcciones privadas; video hasta 300 MB, portada hasta 5 MB). `status` por defecto `pending`; `approved` lo manda directo a la biblioteca.
- El mismo `ref` no se duplica, y un video descartado no se vuelve a recibir. Responde `201` con el archivo.
- Si la URL del archivo es interna del proyecto (red privada), publícala con una URL pública firmada: el publicador solo descarga de internet.
- Llega un WhatsApp (por Canix) «tiene un video nuevo por validar».

## 5. Qué decide el administrador
En la pestaña **Por validar**: **Publicar este** (lo aprueba y abre la publicación para elegir redes y textos), **Guardar** (a la biblioteca, para la automatización o más tarde) o **Descartar** (se borra el archivo).
Si hay `PROJECT_WEBHOOK_URL`, el proyecto recibe `{"event":"asset.validated","ref","status":"approved|rejected","id","project"}` con `X-Publisher-Timestamp` y `X-Publisher-Signature: sha256=HMAC(EMBED_SECRET, "<ts>.<cuerpo>")`.

## 6. docker-compose (ejemplo)
```yaml
  publisher:
    image: publisher-app            # docker build -t publisher-app <ruta de publisher-app>
    restart: unless-stopped
    env_file: ./publisher.env
    volumes: [ "./publisher-data:/app/data" ]
    # sin puertos publicados: solo el nginx del proyecto lo alcanza
```
