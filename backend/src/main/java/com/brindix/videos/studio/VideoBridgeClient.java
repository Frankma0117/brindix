package com.brindix.videos.studio;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;

/** Habla con el puente del host (video-bridge/server.mjs): graba, consulta estado y entrega el MP4. */
@Component
public class VideoBridgeClient {

    public record Asset(InputStream body, String contentType) {}

    private final AppProperties.VideoBridge cfg;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public VideoBridgeClient(AppProperties props, ObjectMapper mapper) {
        this.cfg = props.videoBridge() == null ? new AppProperties.VideoBridge("", "") : props.videoBridge();
        this.mapper = mapper;
    }

    public boolean disponible() {
        return cfg.enabled();
    }

    private HttpRequest.Builder req(String path, Duration timeout) {
        if (!disponible()) throw ApiException.badRequest("El Taller de video no está configurado en este servidor.");
        return HttpRequest.newBuilder(URI.create(cfg.url().replaceAll("/+$", "") + path))
                .timeout(timeout).header("Authorization", "Bearer " + cfg.token());
    }

    private <T> HttpResponse<T> send(HttpRequest r, HttpResponse.BodyHandler<T> h) {
        try {
            return http.send(r, h);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.BAD_GATEWAY, "No se pudo hablar con el grabador de videos. Intenta de nuevo en un momento.");
        }
    }

    private String errorOf(String body, String fallback) {
        try {
            String m = mapper.readTree(body).path("error").asText("");
            return m.isBlank() ? fallback : m;
        } catch (Exception e) {
            return fallback;
        }
    }

    private JsonNode json(String body) {
        try {
            return mapper.readTree(body);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Respuesta inválida del grabador de videos.");
        }
    }

    /** Envía el spec a grabar (el puente responde 202). preview = versión rápida y liviana. */
    public void render(long id, String specJson, boolean preview) {
        HttpResponse<String> r = send(req("/render/" + id + (preview ? "?preview=1" : ""), Duration.ofSeconds(15)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(specJson, StandardCharsets.UTF_8)).build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() == 409) throw ApiException.conflict("Este video ya se está grabando.");
        if (r.statusCode() >= 300) throw ApiException.badRequest("El grabador rechazó el video: " + errorOf(r.body(), "revisa las imágenes."));
    }

    /** {state, detail} de la grabación. */
    public JsonNode status(long id) {
        HttpResponse<String> r = send(req("/status/" + id, Duration.ofSeconds(8)).GET().build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() != 200) throw new ApiException(HttpStatus.BAD_GATEWAY, "El grabador no pudo informar el estado.");
        return json(r.body());
    }

    public void deleteFile(long id) {
        send(req("/file/" + id, Duration.ofSeconds(15)).DELETE().build(), HttpResponse.BodyHandlers.discarding());
    }

    /** MP4 en streaming; quien lo recibe debe cerrarlo. */
    public InputStream openFile(long id) {
        return open("/file/" + id, Duration.ofMinutes(10), "El video ya no está en el grabador.").body();
    }

    public void downloadFile(long id, Path target) {
        try (InputStream in = openFile(id)) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "No se pudo descargar el video del grabador.");
        }
    }

    public Asset openAsset(String path) {
        return open("/asset/" + path, Duration.ofSeconds(20), "No existe esa imagen.");
    }

    /** Rutas de las imágenes disponibles para las escenas. */
    public JsonNode assets() {
        HttpResponse<String> r = send(req("/assets", Duration.ofSeconds(8)).GET().build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() != 200) throw new ApiException(HttpStatus.BAD_GATEWAY, "El grabador no pudo listar las imágenes.");
        return json(r.body()).path("assets");
    }

    private Asset open(String path, Duration timeout, String notFound) {
        HttpResponse<InputStream> r = send(req(path, timeout).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
        if (r.statusCode() != 200) {
            try {
                r.body().close();
            } catch (IOException ignored) {
            }
            throw ApiException.notFound(notFound);
        }
        return new Asset(r.body(), r.headers().firstValue("content-type").orElse("application/octet-stream"));
    }
}
