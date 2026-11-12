package com.brindix.ai;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/** Redacta la descripción de un producto para la carta (proveedor compatible con OpenAI, DeepSeek por defecto). */
@RestController
public class AiController {

    private final AppProperties.Ai cfg;
    private final RestClient http = RestClient.create();

    public AiController(AppProperties props) {
        this.cfg = props.ai();
    }

    public record DescribeInput(@NotBlank @Size(max = 120) String name, @Size(max = 80) String category,
                                @Size(max = 300) String hints) {}

    @PostMapping("/api/admin/ai/describe")
    public Map<String, String> describe(@Valid @RequestBody DescribeInput in) {
        if (!cfg.enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "La IA no está configurada en el servidor");
        String prompt = "Escribe la descripción para la carta de un bar en Colombia del producto \"" + in.name() + "\""
                + (in.category() == null ? "" : " (categoría: " + in.category() + ")")
                + (in.hints() == null || in.hints().isBlank() ? "" : ". Datos: " + in.hints())
                + ". Máximo 18 palabras, en español neutro, apetitosa y concreta (ingredientes o presentación). "
                + "No inventes marcas, precios ni promociones. Sin comillas ni emojis.";
        try {
            JsonNode res = http.post().uri(cfg.baseUrl().replaceAll("/+$", "") + "/chat/completions")
                    .header("Authorization", "Bearer " + cfg.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", cfg.model(), "temperature", 0.7, "max_tokens", 120,
                            "messages", List.of(Map.of("role", "user", "content", prompt))))
                    .retrieve().body(JsonNode.class);
            String text = res == null ? "" : res.path("choices").path(0).path("message").path("content").asText("").trim();
            text = text.replaceAll("^[\"“]+|[\"”]+$", "").trim();
            if (text.isEmpty()) throw new ApiException(HttpStatus.BAD_GATEWAY, "La IA no devolvió texto");
            return Map.of("description", text.length() > 600 ? text.substring(0, 600) : text);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "La IA no respondió. Intenta de nuevo.");
        }
    }
}
