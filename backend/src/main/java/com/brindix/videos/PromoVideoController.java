package com.brindix.videos;

import com.brindix.security.CurrentUser;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Videos de tutoriales y publicidad: solo el súper administrador, desde el panel de la plataforma. */
@RestController
@RequestMapping("/api/platform/videos")
public class PromoVideoController {

    private final PromoVideoService service;

    public PromoVideoController(PromoVideoService service) {
        this.service = service;
    }

    @GetMapping
    public List<PromoVideoService.VideoRow> list() {
        return service.list();
    }

    /** Tipos, formatos, voces y músicas que ofrece el estudio (y si la voz y la IA están listas). */
    @GetMapping("/options")
    public Object options() {
        if (!service.enabled()) return Map.of("enabled", false);
        JsonNode o = service.options();
        return Map.of("enabled", true, "kinds", o.path("kinds"), "formats", o.path("formats"), "voices", o.path("voices"),
                "music", o.path("music"), "voiceReady", o.path("voiceReady").asBoolean(false), "aiReady", o.path("aiReady").asBoolean(false));
    }

    @PostMapping
    public PromoVideoService.VideoRow create(@Valid @RequestBody PromoVideoService.VideoCreate in) {
        return service.create(CurrentUser.get().id(), in);
    }

    @PostMapping("/{id}/retry")
    public PromoVideoService.VideoRow retry(@PathVariable Long id) {
        return service.retry(CurrentUser.get().id(), id);
    }

    @DeleteMapping("/{id}")
    public Map<String, Boolean> delete(@PathVariable Long id) {
        service.delete(id);
        return Map.of("ok", true);
    }
}
