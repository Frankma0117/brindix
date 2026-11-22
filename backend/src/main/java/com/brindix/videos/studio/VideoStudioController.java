package com.brindix.videos.studio;

import com.brindix.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/** Taller de video (solo súper administrador: /api/platform/** ya lo exige). */
@RestController
@RequestMapping("/api/platform/video-studio")
public class VideoStudioController {

    public record SpecIn(String title, JsonNode spec) {}

    private final VideoStudioService service;
    private final VideoBridgeClient bridge;

    public VideoStudioController(VideoStudioService service, VideoBridgeClient bridge) {
        this.service = service;
        this.bridge = bridge;
    }

    @GetMapping
    public Map<String, Object> list() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", service.list().stream().map(service::toMap).toList());
        out.put("available", service.available());
        out.put("template", VideoSpecValidator.brindixTemplate());
        out.put("assets", service.assets());
        return out;
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody SpecIn in) {
        return service.toMap(service.create(in.title(), in.spec()));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody SpecIn in) {
        return service.toMap(service.update(id, in.title(), in.spec()));
    }

    @PostMapping("/{id}/render")
    public Map<String, Object> render(@PathVariable Long id) {
        return service.toMap(service.render(id));
    }

    @PostMapping("/{id}/approve")
    public Map<String, Object> approve(@PathVariable Long id) {
        return service.toMap(service.approve(id));
    }

    @PostMapping("/{id}/discard")
    public Map<String, Object> discard(@PathVariable Long id) {
        return service.toMap(service.discard(id));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable Long id) {
        service.delete(id);
        return Map.of("ok", true);
    }

    /** Vista previa del MP4 grabado (proxy del puente). */
    @GetMapping("/{id}/file")
    public void file(@PathVariable Long id, HttpServletResponse res) throws IOException {
        if (!service.available()) throw ApiException.badRequest("El Taller de video no está disponible en este servidor.");
        try (InputStream in = bridge.openFile(id)) {
            res.setContentType("video/mp4");
            res.setHeader("Cache-Control", "private, no-store");
            in.transferTo(res.getOutputStream());
        }
    }

    /** Imagen del taller (proxy del puente) para el editor. */
    @GetMapping("/asset")
    public void asset(@RequestParam String path, HttpServletResponse res) throws IOException {
        if (!VideoSpecValidator.validAsset(path)) throw ApiException.badRequest("Ruta de imagen inválida.");
        if (!service.available()) throw ApiException.badRequest("El Taller de video no está disponible en este servidor.");
        VideoBridgeClient.Asset a = bridge.openAsset(path);
        try (InputStream in = a.body()) {
            res.setContentType(a.contentType());
            res.setHeader("Cache-Control", "private, max-age=300");
            in.transferTo(res.getOutputStream());
        }
    }
}
