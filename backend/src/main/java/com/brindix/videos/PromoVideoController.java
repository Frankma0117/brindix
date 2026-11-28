package com.brindix.videos;

import com.brindix.security.CurrentUser;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.InputStream;

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

    /** Un pedido: devuelve un registro por formato. */
    @PostMapping
    public List<PromoVideoService.VideoRow> create(@Valid @RequestBody PromoVideoService.VideoCreate in) {
        return service.create(CurrentUser.get().id(), in);
    }

    @PostMapping("/{id}/retry")
    public List<PromoVideoService.VideoRow> retry(@PathVariable Long id) {
        return service.retry(CurrentUser.get().id(), id);
    }

    /** Muestra de una voz para escucharla antes de elegir. */
    @GetMapping("/voices/{key}/sample")
    public JsonNode voiceSample(@PathVariable String key) {
        return service.voiceSample(key);
    }

    /** Voces de fal.ai (Kokoro, MiniMax, ElevenLabs) para audicionar. */
    @GetMapping("/fal-voices")
    public JsonNode falVoices() {
        return service.falVoices();
    }

    @GetMapping("/fal-voices/{model}/{voice}/sample")
    public JsonNode falVoiceSample(@PathVariable String model, @PathVariable String voice) {
        return service.falVoiceSample(model, voice);
    }

    /** Imágenes del taller disponibles para las escenas: [{path}]. */
    @GetMapping("/studio-assets")
    public JsonNode studioAssets() {
        return service.studioAssets();
    }

    @PutMapping("/{id}/spec")
    public PromoVideoService.VideoRow saveSpec(@PathVariable Long id, @RequestBody Map<String, JsonNode> body) {
        return service.saveSpec(id, body.get("spec"));
    }

    /** Voz y música de la versión final (vacío = ninguna). */
    @PutMapping("/{id}/audio")
    public PromoVideoService.VideoRow saveAudio(@PathVariable Long id, @Valid @RequestBody PromoVideoService.AudioIn in) {
        return service.saveAudio(id, in);
    }

    @PostMapping("/{id}/preview")
    public PromoVideoService.VideoRow preview(@PathVariable Long id) {
        return service.preview(id);
    }

    @PostMapping("/{id}/approve")
    public PromoVideoService.VideoRow approve(@PathVariable Long id) {
        return service.approve(id);
    }

    /** MP4 de la versión previa (el panel lo pide con el token y lo muestra como blob). */
    @GetMapping("/{id}/preview")
    public ResponseEntity<StreamingResponseBody> previewFile(@PathVariable Long id) {
        InputStream in = service.openPreview(id);
        StreamingResponseBody body = out -> {
            try (in) {
                in.transferTo(out);
            }
        };
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("video/mp4")).body(body);
    }

    @DeleteMapping("/{id}")
    public Map<String, Boolean> delete(@PathVariable Long id) {
        service.delete(id);
        return Map.of("ok", true);
    }
}
