package com.brindix.videos;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/** Habla con el estudio de videos (contenedor "studio", solo por la red interna). */
@Component
public class StudioClient {

    private final AppProperties.Studio cfg;
    private final RestClient http = RestClient.create();
    /** La voz por escena tarda: hasta 5 minutos de espera. */
    private final RestClient narrateHttp = RestClient.builder().requestFactory(narrateFactory()).build();

    private static org.springframework.http.client.SimpleClientHttpRequestFactory narrateFactory() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(5 * 60 * 1000);
        return f;
    }

    public StudioClient(AppProperties props) {
        this.cfg = props.studio();
    }

    public boolean enabled() {
        return cfg != null && cfg.enabled();
    }

    private RestClient.RequestHeadersSpec<?> auth(RestClient.RequestHeadersSpec<?> spec) {
        return spec.header("X-Studio-Token", cfg.token());
    }

    private String url(String path) {
        return cfg.url().replaceAll("/+$", "") + path;
    }

    private void requireEnabled() {
        if (!enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "El estudio de videos no está configurado en el servidor");
    }

    public JsonNode options() {
        requireEnabled();
        try {
            return auth(http.get().uri(url("/options"))).retrieve().body(JsonNode.class);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "El estudio no responde. Intenta en un momento.");
        }
    }

    /** Un pedido: el estudio arma un MP4 por formato con el mismo guion y la misma voz. */
    public void submit(String jobId, PromoVideo sample, List<String> formats) {
        requireEnabled();
        try {
            auth(http.post().uri(url("/jobs")).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("id", jobId, "kind", sample.getKind(), "formats", formats,
                            "idea", sample.getIdea() == null ? "" : sample.getIdea(), "voice", sample.getVoice(), "music", sample.getMusic())))
                    .retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "El estudio no recibió el pedido. Intenta en un momento.");
        }
    }

    /** Audio de la versión final: {seconds:{intro,scenes[],outro}, audio:base64 mp3}. Tarda (una voz por escena). */
    public JsonNode narrate(String specJson, String voice, String music) {
        if (!enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "El estudio de videos no está configurado en el servidor");
        try {
            com.fasterxml.jackson.databind.node.ObjectNode body = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
            body.set("spec", new com.fasterxml.jackson.databind.ObjectMapper().readTree(specJson));
            body.put("voice", voice == null ? "" : voice);
            body.put("music", music == null ? "" : music);
            return auth(narrateHttp.post().uri(url("/narrate")).contentType(MediaType.APPLICATION_JSON).body(body.toString()))
                    .retrieve().body(JsonNode.class);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            String why = "No se pudo generar el audio.";
            try {
                why = new com.fasterxml.jackson.databind.ObjectMapper().readTree(e.getResponseBodyAsString()).path("detail").asText(why);
            } catch (Exception ignored) {
            }
            throw new ApiException(HttpStatus.BAD_GATEWAY, why);
        } catch (RestClientException | java.io.IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "El estudio no respondió al generar el audio.");
        }
    }

    /** null si el estudio no sabe de ese pedido (se reinició) o no responde. */
    public JsonNode status(String jobId) {
        if (!enabled()) return null;
        try {
            return auth(http.get().uri(url("/jobs/" + jobId))).retrieve().body(JsonNode.class);
        } catch (RestClientException e) {
            return null;
        }
    }

    public void delete(String jobId, String format) {
        if (!enabled()) return;
        try {
            auth(http.delete().uri(url("/videos/" + jobId + "/" + format))).retrieve().toBodilessEntity();
        } catch (RestClientException ignored) {
            // si el estudio no está, los archivos quedan en Spaces; el registro se borra igual
        }
    }

    /** Muestra de una voz (mp3 público) para escucharla antes de elegir. */
    public JsonNode voiceSample(String key) {
        requireEnabled();
        try {
            return auth(http.get().uri(url("/voices/" + key + "/sample"))).retrieve().body(JsonNode.class);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "No se pudo traer la muestra de esa voz. Intenta en un momento.");
        }
    }
}
