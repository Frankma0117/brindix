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
        Jwt jwt,
        String secretKey,
        Seed seed,
        Storage storage,
        Ai ai) {

    public record Jwt(String secret, int hours) {}

    public record Seed(boolean enabled, String superUsername, String superPassword, boolean demoVenue,
                       String adminPassword, String waiterPassword) {}

    /** DigitalOcean Spaces (API compatible con S3). Sin key/secret se guarda en disco. */
    public record Storage(String endpoint, String region, String bucket, String prefix, String key, String secret, String cdnUrl) {
        public boolean spaces() {
            return notBlank(key) && notBlank(secret) && notBlank(bucket) && notBlank(endpoint);
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
