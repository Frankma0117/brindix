package com.brindix.music;

import com.brindix.common.ApiException;
import com.brindix.venue.Venue;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Búsqueda en YouTube (Data API v3) con la API key del bar. La reproducción la hace la pantalla del
 * bar con el reproductor oficial de YouTube. Cada búsqueda gasta 100 de las 10.000 unidades diarias
 * gratis de la key, por eso los resultados se guardan 30 minutos.
 */
@Component
public class YouTubeClient {

    private static final String API = "https://www.googleapis.com/youtube/v3";
    /** Con tiempo límite: si el servicio tarda, el cliente ve el error con «Reintentar» en vez de esperar sin fin. */
    private final RestClient http = RestClient.builder().requestFactory(timeouts()).build();

    private static org.springframework.http.client.JdkClientHttpRequestFactory timeouts() {
        var f = new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5)).build());
        f.setReadTimeout(java.time.Duration.ofSeconds(10));
        return f;
    }
    private final Map<String, Object[]> cache = new ConcurrentHashMap<>();

    public List<MusicDtos.Track> search(String apiKey, String query) {
        if (apiKey == null) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Falta la API key de YouTube en Configuración");
        String q = query.trim().toLowerCase();
        Object[] hit = cache.get(q);
        if (hit != null && Instant.now().isBefore((Instant) hit[1])) {
            @SuppressWarnings("unchecked") List<MusicDtos.Track> cached = (List<MusicDtos.Track>) hit[0];
            return cached;
        }
        JsonNode res = get(UriComponentsBuilder.fromUriString(API + "/search")
                .queryParam("part", "snippet").queryParam("type", "video").queryParam("maxResults", 10)
                .queryParam("videoEmbeddable", "true").queryParam("videoCategoryId", "10").queryParam("regionCode", "CO")
                .queryParam("q", query.trim()).queryParam("key", apiKey).encode().build().toUriString());
        List<String> ids = new ArrayList<>();
        Map<String, JsonNode> snippets = new LinkedHashMap<>();
        res.path("items").forEach(n -> {
            String id = n.path("id").path("videoId").asText(null);
            if (id != null) {
                ids.add(id);
                snippets.put(id, n.path("snippet"));
            }
        });
        Map<String, Integer> durations = new HashMap<>();
        if (!ids.isEmpty()) {
            get(UriComponentsBuilder.fromUriString(API + "/videos").queryParam("part", "contentDetails")
                    .queryParam("id", String.join(",", ids)).queryParam("key", apiKey).encode().build().toUriString())
                    .path("items").forEach(n -> {
                        try {
                            durations.put(n.path("id").asText(), (int) Duration.parse(n.path("contentDetails").path("duration").asText()).toMillis());
                        } catch (Exception ignored) {
                            // videos en vivo no tienen duración
                        }
                    });
        }
        List<MusicDtos.Track> out = new ArrayList<>();
        snippets.forEach((id, s) -> {
            String title = HtmlUtils.htmlUnescape(s.path("title").asText());
            String channel = HtmlUtils.htmlUnescape(s.path("channelTitle").asText("")).replaceAll("(?i)\\s*-\\s*topic$|VEVO$", "").trim();
            JsonNode th = s.path("thumbnails");
            String image = th.path("high").path("url").asText(th.path("medium").path("url").asText(th.path("default").path("url").asText(null)));
            out.add(new MusicDtos.Track(Venue.MusicProvider.YOUTUBE, id, title, channel, null, image, durations.get(id), false));
        });
        cache.put(q, new Object[]{out, Instant.now().plusSeconds(1800)});
        if (cache.size() > 500) cache.clear();
        return out;
    }

    private JsonNode get(String url) {
        try {
            JsonNode body = http.get().uri(url).retrieve().body(JsonNode.class);
            if (body == null) throw new ApiException(HttpStatus.BAD_GATEWAY, "YouTube no respondió");
            return body;
        } catch (RestClientResponseException e) {
            String b = e.getResponseBodyAsString();
            if (b.contains("quotaExceeded")) throw ApiException.tooMany("Se agotaron las búsquedas de YouTube por hoy (cuota de la API key).");
            if (e.getStatusCode().value() == 400 || e.getStatusCode().value() == 403) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "YouTube rechazó la API key. Revísala en Configuración.");
            }
            throw new ApiException(HttpStatus.BAD_GATEWAY, "YouTube no respondió (" + e.getStatusCode().value() + ")");
        } catch (org.springframework.web.client.ResourceAccessException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "No hay conexión con YouTube");
        }
    }
}
