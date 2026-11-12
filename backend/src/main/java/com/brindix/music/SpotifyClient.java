package com.brindix.music;

import com.brindix.common.ApiException;
import com.brindix.venue.Venue;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Llamadas HTTP a Spotify. Cada bar registra SU propia app (Client ID / Secret en su configuración)
 * y conecta su cuenta Premium con el flujo Authorization Code.
 */
@Component
public class SpotifyClient {

    private static final Logger log = LoggerFactory.getLogger(SpotifyClient.class);
    private static final String ACCOUNTS = "https://accounts.spotify.com";
    private static final String API = "https://api.spotify.com/v1";
    static final String SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing";

    public record Credentials(String clientId, String clientSecret) {}

    public record Tokens(String accessToken, String refreshToken, int expiresIn) {}

    public record PlayerState(MusicDtos.Track track, int progressMs, boolean playing) {}

    private final RestClient http = RestClient.create();
    /** Token "de aplicación" por clientId: sirve para buscar aunque la cuenta aún no esté conectada. */
    private final Map<String, Object[]> appTokens = new ConcurrentHashMap<>();

    public String authorizeUrl(Credentials c, String redirectUri, String state) {
        return UriComponentsBuilder.fromUriString(ACCOUNTS + "/authorize")
                .queryParam("response_type", "code")
                .queryParam("client_id", c.clientId())
                .queryParam("scope", SCOPES)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .queryParam("show_dialog", "true")
                .encode().build().toUriString();
    }

    public Tokens exchangeCode(Credentials c, String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        JsonNode json = token(c, form);
        return new Tokens(json.path("access_token").asText(), json.path("refresh_token").asText(null), json.path("expires_in").asInt(3600));
    }

    public Tokens refresh(Credentials c, String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);
        JsonNode json = token(c, form);
        return new Tokens(json.path("access_token").asText(), json.path("refresh_token").asText(refreshToken), json.path("expires_in").asInt(3600));
    }

    public String accountName(String accessToken) {
        JsonNode me = get(accessToken, API + "/me");
        String name = me.path("display_name").asText("");
        return name.isBlank() ? me.path("id").asText("Spotify") : name;
    }

    public List<MusicDtos.Track> search(Credentials c, String userToken, String query, int limit) {
        String token = userToken != null ? userToken : appToken(c);
        String url = UriComponentsBuilder.fromUriString(API + "/search")
                .queryParam("q", query.trim()).queryParam("type", "track")
                .queryParam("limit", Math.max(1, Math.min(10, limit))).queryParam("market", "CO") // Spotify acepta hasta 10
                .encode().build().toUriString();
        List<MusicDtos.Track> out = new ArrayList<>();
        get(token, url).path("tracks").path("items").forEach(n -> out.add(track(n)));
        return out;
    }

    public Optional<PlayerState> currentlyPlaying(String accessToken) {
        ResponseEntity<JsonNode> res = call(() -> http.get().uri(API + "/me/player/currently-playing")
                .header("Authorization", "Bearer " + accessToken).retrieve().toEntity(JsonNode.class));
        JsonNode body = res.getBody();
        if (res.getStatusCode().value() == 204 || body == null || body.path("item").isMissingNode() || body.path("item").isNull()) {
            return Optional.empty();
        }
        return Optional.of(new PlayerState(track(body.path("item")), body.path("progress_ms").asInt(0), body.path("is_playing").asBoolean(false)));
    }

    public void addToQueue(String accessToken, String uri) {
        String url = UriComponentsBuilder.fromUriString(API + "/me/player/queue").queryParam("uri", uri).encode().build().toUriString();
        call(() -> http.post().uri(url).header("Authorization", "Bearer " + accessToken).retrieve().toBodilessEntity());
    }

    public void skip(String accessToken) {
        call(() -> http.post().uri(API + "/me/player/next").header("Authorization", "Bearer " + accessToken).retrieve().toBodilessEntity());
    }

    public void pause(String accessToken) {
        call(() -> http.put().uri(API + "/me/player/pause").header("Authorization", "Bearer " + accessToken).retrieve().toBodilessEntity());
    }

    public void play(String accessToken) {
        call(() -> http.put().uri(API + "/me/player/play").header("Authorization", "Bearer " + accessToken).retrieve().toBodilessEntity());
    }

    // ------------------------------------------------------------------

    private String appToken(Credentials c) {
        Object[] cached = appTokens.get(c.clientId());
        if (cached != null && Instant.now().isBefore(((Instant) cached[1]).minusSeconds(60))) return (String) cached[0];
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        JsonNode json = token(c, form);
        String t = json.path("access_token").asText();
        appTokens.put(c.clientId(), new Object[]{t, Instant.now().plusSeconds(json.path("expires_in").asInt(3600))});
        return t;
    }

    private JsonNode token(Credentials c, MultiValueMap<String, String> form) {
        if (c == null || c.clientId() == null || c.clientSecret() == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Falta configurar el Client ID y el Client secret de Spotify");
        }
        String basic = Base64.getEncoder().encodeToString((c.clientId() + ":" + c.clientSecret()).getBytes(StandardCharsets.UTF_8));
        return call(() -> http.post().uri(ACCOUNTS + "/api/token")
                .header("Authorization", "Basic " + basic)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve().toEntity(JsonNode.class)).getBody();
    }

    private JsonNode get(String token, String url) {
        JsonNode body = call(() -> http.get().uri(url).header("Authorization", "Bearer " + token).retrieve().toEntity(JsonNode.class)).getBody();
        if (body == null) throw new ApiException(HttpStatus.BAD_GATEWAY, "Spotify no respondió");
        return body;
    }

    private static MusicDtos.Track track(JsonNode n) {
        StringBuilder artists = new StringBuilder();
        n.path("artists").forEach(a -> {
            if (!artists.isEmpty()) artists.append(", ");
            artists.append(a.path("name").asText());
        });
        JsonNode images = n.path("album").path("images");
        String image = images.isArray() && !images.isEmpty() ? images.get(0).path("url").asText(null) : null;
        return new MusicDtos.Track(Venue.MusicProvider.SPOTIFY, n.path("uri").asText(), n.path("name").asText(), artists.toString(),
                n.path("album").path("name").asText(null), image, n.path("duration_ms").asInt(0), n.path("explicit").asBoolean(false));
    }

    private <T> ResponseEntity<T> call(java.util.function.Supplier<ResponseEntity<T>> fn) {
        try {
            return fn.get();
        } catch (RestClientResponseException e) {
            throw translate(e.getStatusCode(), e.getResponseBodyAsString());
        } catch (org.springframework.web.client.ResourceAccessException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "No hay conexión con Spotify");
        }
    }

    static ApiException translate(HttpStatusCode status, String body) {
        log.warn("Spotify respondió {}: {}", status, body == null ? "" : body.length() > 400 ? body.substring(0, 400) : body);
        return switch (status.value()) {
            case 400 -> body != null && body.contains("invalid_grant")
                    ? new SpotifyAuthException("La conexión con Spotify venció. Conecta la cuenta de nuevo.")
                    : body != null && body.contains("invalid_client")
                    ? new ApiException(HttpStatus.BAD_GATEWAY, "Spotify no reconoce el Client ID / Client secret. Revísalos en Configuración.")
                    : new ApiException(HttpStatus.BAD_GATEWAY, "Spotify rechazó la solicitud");
            case 401 -> new SpotifyAuthException("La sesión de Spotify venció. Conecta la cuenta de nuevo.");
            case 403 -> new ApiException(HttpStatus.BAD_GATEWAY, "Spotify no lo permite: la cuenta debe ser Premium y estar agregada en User Management de la app.");
            case 404 -> new ApiException(HttpStatus.CONFLICT, "No hay un reproductor activo. Abre Spotify en el computador del bar y pon a sonar algo.");
            case 429 -> new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Spotify pidió esperar un momento. Intenta en unos segundos.");
            default -> new ApiException(HttpStatus.BAD_GATEWAY, "Spotify no respondió (" + status.value() + ")");
        };
    }

    /** Token inválido o revocado: hay que volver a conectar la cuenta. */
    public static class SpotifyAuthException extends ApiException {
        public SpotifyAuthException(String message) {
            super(HttpStatus.UNAUTHORIZED, message);
        }
    }
}
