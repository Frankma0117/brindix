package com.brindix.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

/** Todo lo que vive bajo "brindix:" en application.yml. */
@ConfigurationProperties(prefix = "brindix")
public record AppProperties(
        String publicUrl,
        String apiUrl,
        String corsOrigins,
        String timezone,
        String uploadsDir,
        String whatsapp,
        /** Carta del bar demo que enlaza la landing ("Ver una carta real"); vacío = sin enlace. */
        String demoUrl,
        /** BRINDIX_RECOVERY_KEY: recupera la contraseña del súper administrador (mínimo 24 caracteres). */
        String recoveryKey,
        Jwt jwt,
        String secretKey,
        Seed seed,
        Storage storage,
        Ai ai,
        Mail mail,
        Studio studio) {

    public record Jwt(String secret, int hours) {}

    public record Seed(boolean enabled, String superUsername, String superPassword, boolean demoVenue,
                       String adminPassword, String waiterPassword) {}

    /** DigitalOcean Spaces (API compatible con S3). Sin key/secret se guarda en disco. */
    public record Storage(String endpoint, String region, String bucket, String prefix, String key, String secret, String cdnUrl) {
        public boolean spaces() {
            return notBlank(key) && notBlank(secret) && notBlank(bucket) && notBlank(endpoint);
        }
    }

    /** Correo saliente (SMTP en spring.mail.*). adminEmail = correo del súper administrador para avisos. */
    public record Mail(String host, String from, String fromName, String adminEmail) {
        public boolean enabled() {
            return notBlank(host);
        }
    }

    /** Estudio de videos (contenedor interno). Sin url o token, la pestaña de videos avisa que no está configurado. */
    public record Studio(String url, String token) {
        public boolean enabled() {
            return notBlank(url) && notBlank(token);
        }
    }

    public record Ai(String baseUrl, String apiKey, String model) {
        public boolean enabled() {
            return notBlank(apiKey);
        }
    }

    public ZoneId zone() {
        return ZoneId.of(notBlank(timezone) ? timezone : "America/Bogota");
    }

    public List<String> corsOriginList() {
        return Arrays.stream(corsOrigins == null ? new String[0] : corsOrigins.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    /** Redirect URI que cada bar debe registrar en su app de Spotify. */
    public String spotifyRedirectUri() {
        return trimSlash(apiUrl) + "/api/spotify/callback";
    }

    public String publicBase() {
        return trimSlash(publicUrl);
    }

    static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String trimSlash(String s) {
        return s == null ? "" : s.replaceAll("/+$", "");
    }
}
