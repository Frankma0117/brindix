package com.brindix.publisher;

import com.brindix.common.AppProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;

/** Habla con el publicador de redes (contenedor "publisher", solo por la red interna). */
@Component
public class PublisherClient {

    private static final String BASE_PATH = "/publicador";

    private final AppProperties.Publisher cfg;
    private final RestClient http = RestClient.create();

    public PublisherClient(AppProperties props) {
        this.cfg = props.publisher();
    }

    public boolean enabled() {
        return cfg != null && cfg.enabled();
    }

    private String url(String path) {
        return cfg.url().replaceAll("/+$", "") + BASE_PATH + path;
    }

    /** ¿Responde el contenedor? */
    public boolean up() {
        if (!enabled()) return false;
        try {
            http.get().uri(url("/api/health")).retrieve().toBodilessEntity();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Envía un video a la bandeja «Por validar». Idempotente: el publicador no duplica el mismo ref.
     * Lanza excepción si no pudo (el llamador lo reintenta más tarde).
     */
    public void push(String videoUrl, String title, String caption, String ref, String thumbnailUrl) {
        Map<String, Object> body = new HashMap<>();
        body.put("url", videoUrl);
        body.put("title", title);
        body.put("caption", caption == null ? "" : caption);
        body.put("ref", ref);
        body.put("status", "pending");
        if (thumbnailUrl != null && thumbnailUrl.startsWith("https://")) body.put("thumbnailUrl", thumbnailUrl);
        http.post().uri(url("/api/v1/assets"))
                .header("Authorization", "Bearer " + cfg.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().toBodilessEntity();
    }

    public String ticketUrl() {
        return BASE_PATH + "/sso?ticket=" + PublisherTicket.create(cfg.embedSecret(), 60);
    }
}
