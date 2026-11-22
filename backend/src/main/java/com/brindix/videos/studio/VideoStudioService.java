package com.brindix.videos.studio;

import com.brindix.common.ApiException;
import com.brindix.uploads.StorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Taller de video: guiones, grabación en el puente del host y aprobación (el MP4 final va a Spaces). */
@Service
public class VideoStudioService {
    private static final Logger log = LoggerFactory.getLogger(VideoStudioService.class);

    private final VideoSpecRepository repo;
    private final VideoBridgeClient bridge;
    private final StorageService storage;
    private final ObjectMapper mapper;

    public VideoStudioService(VideoSpecRepository repo, VideoBridgeClient bridge, StorageService storage, ObjectMapper mapper) {
        this.repo = repo;
        this.bridge = bridge;
        this.storage = storage;
        this.mapper = mapper;
    }

    public boolean available() {
        return bridge.disponible();
    }

    public Map<String, Object> toMap(VideoSpecRow r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("title", r.getTitle());
        try {
            m.put("spec", mapper.readTree(r.getSpec()));
        } catch (IOException e) {
            m.put("spec", null);
        }
        m.put("status", r.getStatus());
        m.put("detail", r.getDetail());
        m.put("url", r.getUrl());
        m.put("createdAt", r.getCreatedAt());
        m.put("updatedAt", r.getUpdatedAt());
        return m;
    }

    /** Lista los guiones; antes consulta al puente por los que están grabando. */
    public List<VideoSpecRow> list() {
        List<VideoSpecRow> rows = repo.findAllByOrderByIdDesc();
        if (available()) rows.stream().filter(r -> VideoSpecRow.RENDERING.equals(r.getStatus())).forEach(this::refresh);
        return rows;
    }

    private void refresh(VideoSpecRow r) {
        try {
            JsonNode st = bridge.status(r.getId());
            String state = st.path("state").asText("");
            if ("done".equals(state)) {
                r.setStatus(VideoSpecRow.REVIEW);
                r.setDetail(null);
            } else if ("error".equals(state)) {
                r.setStatus(VideoSpecRow.ERROR);
                r.setDetail(st.path("detail").asText("No se pudo grabar el video."));
            } else {
                return;
            }
            touch(r);
        } catch (RuntimeException e) {
            log.warn("No se pudo consultar el estado del video {}: {}", r.getId(), e.getMessage());
        }
    }

    private void touch(VideoSpecRow r) {
        r.setUpdatedAt(Instant.now());
        repo.save(r);
    }

    private VideoSpecRow get(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("No existe ese video."));
    }

    private String title(String t) {
        String s = t == null ? "" : t.trim();
        if (s.isEmpty()) throw ApiException.badRequest("Falta el título.");
        if (s.length() > 120) throw ApiException.badRequest("El título es demasiado largo (máximo 120).");
        return s;
    }

    private String normalize(JsonNode spec) {
        return VideoSpecValidator.parse(spec).toString();
    }

    public VideoSpecRow create(String title, JsonNode spec) {
        VideoSpecRow r = new VideoSpecRow();
        r.setTitle(title(title));
        r.setSpec(normalize(spec));
        return repo.save(r);
    }

    public VideoSpecRow update(Long id, String title, JsonNode spec) {
        VideoSpecRow r = get(id);
        if (VideoSpecRow.RENDERING.equals(r.getStatus())) throw ApiException.conflict("El video se está grabando; espera a que termine.");
        r.setTitle(title(title));
        r.setSpec(normalize(spec));
        if (!VideoSpecRow.APPROVED.equals(r.getStatus())) {
            r.setStatus(VideoSpecRow.DRAFT);
            r.setDetail(null);
        }
        touch(r);
        return r;
    }

    public VideoSpecRow render(Long id) {
        if (!available()) throw ApiException.badRequest("El Taller de video no está disponible en este servidor.");
        VideoSpecRow r = get(id);
        if (VideoSpecRow.RENDERING.equals(r.getStatus())) throw ApiException.conflict("El video ya se está grabando.");
        try {
            r.setSpec(normalize(mapper.readTree(r.getSpec())));
        } catch (IOException e) {
            throw ApiException.badRequest("El guion guardado no es válido.");
        }
        bridge.render(r.getId(), r.getSpec());
        r.setStatus(VideoSpecRow.RENDERING);
        r.setDetail(null);
        touch(r);
        return r;
    }

    public VideoSpecRow approve(Long id) {
        VideoSpecRow r = get(id);
        if (!VideoSpecRow.REVIEW.equals(r.getStatus())) throw ApiException.conflict("Solo se aprueban videos listos para revisar.");
        Path tmp = null;
        try {
            tmp = Files.createTempFile("brindix-video-", ".mp4");
            bridge.downloadFile(r.getId(), tmp);
            String name = "video-" + r.getId() + "-" + System.currentTimeMillis() + ".mp4";
            r.setUrl(storage.saveVideo("videos", name, tmp));
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo preparar el video", e);
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                }
            }
        }
        try {
            bridge.deleteFile(r.getId());
        } catch (RuntimeException e) {
            log.warn("No se pudo borrar el video {} del puente: {}", r.getId(), e.getMessage());
        }
        r.setStatus(VideoSpecRow.APPROVED);
        r.setDetail(null);
        touch(r);
        return r;
    }

    public VideoSpecRow discard(Long id) {
        VideoSpecRow r = get(id);
        if (VideoSpecRow.RENDERING.equals(r.getStatus())) throw ApiException.conflict("El video se está grabando.");
        if (available()) {
            try {
                bridge.deleteFile(r.getId());
            } catch (RuntimeException e) {
                log.warn("No se pudo borrar el video {} del puente: {}", r.getId(), e.getMessage());
            }
        }
        r.setStatus(VideoSpecRow.DRAFT);
        r.setDetail(null);
        touch(r);
        return r;
    }

    public void delete(Long id) {
        VideoSpecRow r = get(id);
        if (VideoSpecRow.RENDERING.equals(r.getStatus())) throw ApiException.conflict("El video se está grabando.");
        if (available() && !VideoSpecRow.APPROVED.equals(r.getStatus())) {
            try {
                bridge.deleteFile(r.getId());
            } catch (RuntimeException e) {
                log.warn("No se pudo borrar el video {} del puente: {}", r.getId(), e.getMessage());
            }
        }
        repo.delete(r);
    }

    /** Rutas de imágenes del puente; vacío si no está disponible o falla. */
    public JsonNode assets() {
        if (!available()) return mapper.createArrayNode();
        try {
            return bridge.assets();
        } catch (RuntimeException e) {
            log.warn("No se pudieron listar las imágenes del taller: {}", e.getMessage());
            return mapper.createArrayNode();
        }
    }
}
