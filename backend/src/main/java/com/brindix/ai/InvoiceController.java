package com.brindix.ai;

import com.brindix.catalog.ProductRepository;
import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.brindix.recipes.IngredientRepository;
import com.brindix.security.CurrentUser;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Lee la foto de una factura de compra con un modelo de visión. Solo lectura: no guarda la imagen ni escribe en la BD. */
@RestController
public class InvoiceController {

    private static final long MAX_BYTES = 8L * 1024 * 1024;
    private static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private static final String PROMPT = "Eres un lector de facturas de compra de un bar en Colombia. Lee la imagen y responde SOLO con un objeto JSON "
            + "(sin texto extra ni markdown) con esta forma: {\"proveedor\": string|null, \"numero\": string|null, \"fecha\": \"AAAA-MM-DD\"|null, "
            + "\"total\": number|null, \"lineas\": [{\"descripcion\": string, \"cantidad\": number, \"unidad\": string|null, "
            + "\"costoUnitario\": number|null, \"costoTotal\": number|null}]}. Los valores en pesos van como número sin símbolos ni separadores de miles. "
            + "Una línea por ítem comprado; no inventes datos que no se vean (usa null).";

    public record MatchView(String kind, Long id, String name, double score) {}

    public record LineView(String descripcion, BigDecimal cantidad, String unidad, BigDecimal costoUnitario,
                           BigDecimal costoTotal, MatchView match) {}

    public record InvoiceView(String proveedor, String numero, String fecha, BigDecimal total, List<LineView> lineas) {}

    private final AppProperties.Ai cfg;
    private final ProductRepository products;
    private final IngredientRepository ingredients;
    private final RestClient http = RestClient.create();

    public InvoiceController(AppProperties props, ProductRepository products, IngredientRepository ingredients) {
        this.cfg = props.ai();
        this.products = products;
        this.ingredients = ingredients;
    }

    @PostMapping(value = "/api/admin/ai/invoice", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InvoiceView invoice(@RequestParam("file") MultipartFile file) throws IOException {
        if (!cfg.visionEnabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Configura la IA en Configuración");
        if (file.isEmpty()) throw ApiException.badRequest("El archivo está vacío");
        if (file.getSize() > MAX_BYTES) throw ApiException.badRequest("La imagen pesa más de 8 MB");
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!TYPES.contains(type)) throw ApiException.badRequest("Sube una imagen JPG, PNG o WEBP");

        String dataUrl = "data:" + type + ";base64," + Base64.getEncoder().encodeToString(file.getBytes());
        String raw;
        try {
            JsonNode res = http.post().uri(cfg.visionBaseUrlOrDefault().replaceAll("/+$", "") + "/chat/completions")
                    .header("Authorization", "Bearer " + cfg.visionApiKeyOrDefault())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", cfg.visionModelOrDefault(), "temperature", 0, "max_tokens", 3000,
                            "messages", List.of(Map.of("role", "user", "content", List.of(
                                    Map.of("type", "text", "text", PROMPT),
                                    Map.of("type", "image_url", "image_url", Map.of("url", dataUrl)))))))
                    .retrieve().body(JsonNode.class);
            raw = res == null ? "" : res.path("choices").path(0).path("message").path("content").asText("");
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "La IA no pudo leer la imagen. Revisa que el modelo admita imágenes e intenta de nuevo.");
        }
        InvoiceParser.Invoice inv = InvoiceParser.parse(raw);
        if (inv == null || inv.lineas().isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "No se pudo leer la factura. Prueba con una foto más nítida y completa.");
        }

        Long venueId = CurrentUser.venueId();
        List<InvoiceMatcher.Candidate> cands = new ArrayList<>();
        products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(venueId).stream()
                .filter(p -> p.isTrackStock()).forEach(p -> cands.add(new InvoiceMatcher.Candidate("PRODUCT", p.getId(), p.getName())));
        ingredients.findByVenueIdAndArchivedFalseOrderByNameAsc(venueId)
                .forEach(i -> cands.add(new InvoiceMatcher.Candidate("INGREDIENT", i.getId(), i.getName())));

        List<LineView> lines = inv.lineas().stream().map(l -> {
            InvoiceMatcher.Match m = InvoiceMatcher.best(l.descripcion(), cands);
            return new LineView(l.descripcion(), l.cantidad(), l.unidad(), l.costoUnitario(), l.costoTotal(),
                    m == null ? null : new MatchView(m.kind(), m.id(), m.name(), m.score()));
        }).toList();
        return new InvoiceView(inv.proveedor(), inv.numero(), inv.fecha(), inv.total(), lines);
    }
}
