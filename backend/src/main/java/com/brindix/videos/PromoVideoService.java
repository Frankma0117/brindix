package com.brindix.videos;

import com.brindix.common.ApiException;
import com.brindix.uploads.StorageService;
import com.brindix.videos.studio.VideoBridgeClient;
import com.brindix.videos.studio.VideoSpecValidator;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PromoVideoService {
    /** Claves de voz del estudio: H1–H35 y M1–M39 (studio/catalog.py). La muestra y el pedido usan la misma regla. */
    public static final String VOICE_KEY = "[HM][0-9]{1,2}";


    private static final Logger log = LoggerFactory.getLogger(PromoVideoService.class);
    private static final List<String> FORMATS = List.of("vertical", "horizontal", "cuadrado");
    /** Pedidos (no videos) en cola o en proceso a la vez. */
    private static final int MAX_ACTIVE_JOBS = 3;
    /** Un pedido con tres formatos tarda unos 15 minutos; si pasa esto sin terminar, se da por perdido. */
    private static final Duration MAX_RUN = Duration.ofMinutes(40);

    private final PromoVideoRepository repo;
    private final StudioClient studio;
    private final ObjectMapper json;
    private final VideoBridgeClient bridge;
    private final StorageService storage;

    public PromoVideoService(PromoVideoRepository repo, StudioClient studio, ObjectMapper json, VideoBridgeClient bridge, StorageService storage) {
        this.repo = repo;
        this.studio = studio;
        this.json = json;
        this.bridge = bridge;
        this.storage = storage;
    }

    /** Tipo de video con recuadros y mascota de cuerpo entero: lo graba el taller Remotion del servidor (sin voz). */
    public static final String KIND_CALLOUTS = "recuadros";
    private static final Map<String, String> CALLOUT_NAME = Map.of("vertical", "Reel", "cuadrado", "Instagram", "horizontal", "Tutorial guiado");
    private static final Map<String, String> BRIDGE_FORMAT = Map.of("vertical", "9x16", "horizontal", "16x9", "cuadrado", "1x1");

    public record VideoRow(Long id, String jobId, String kind, String kindName, String format, String voice, String music, String idea,
                           PromoVideo.Status status, int progress, String detail, String title, String caption, JsonNode script,
                           String videoUrl, String posterUrl, Double seconds, Instant createdAt, Instant finishedAt, JsonNode spec) {}

    public record VideoCreate(@NotBlank @Pattern(regexp = "[a-z_]+") String kind,
                              @NotEmpty List<@Pattern(regexp = "vertical|horizontal|cuadrado") String> formats,
                              @NotBlank @Pattern(regexp = VOICE_KEY) String voice,
                              @NotBlank @Pattern(regexp = "[a-z]+") String music,
                              @Size(max = 600) String idea) {}

    public JsonNode options() {
        JsonNode o = studio.options();
        if (bridge.disponible() && o instanceof ObjectNode on && on.path("kinds") instanceof ArrayNode kinds) {
            kinds.addObject().put("key", KIND_CALLOUTS).put("name", "Con recuadros y mascota")
                    .put("about", "Imágenes de la demo con recuadros que explican y la copa de cuerpo entero señalando. Sin voz.").put("seconds", 25);
        }
        return o;
    }

    public boolean enabled() {
        return studio.enabled() || bridge.disponible();
    }

    public JsonNode voiceSample(String key) {
        if (key == null || !key.matches(VOICE_KEY)) throw ApiException.badRequest("Esa voz no existe");
        return studio.voiceSample(key);
    }

    public List<VideoRow> list() {
        return repo.findAllByOrderByIdDesc().stream().map(this::row).toList();
    }

    private List<PromoVideo> active() {
        return repo.findByStatusIn(List.of(PromoVideo.Status.QUEUED, PromoVideo.Status.RUNNING));
    }

    /** Un pedido: un registro por formato, todos con el mismo jobId, y un solo trabajo en el estudio. */
    @Transactional
    public List<VideoRow> create(Long by, VideoCreate in) {
        boolean callouts = KIND_CALLOUTS.equals(in.kind());
        // con recuadros siempre salen los 3 tipos (Reel, Instagram, Tutorial guiado), sin importar lo que pida el request
        List<String> formats = callouts ? List.of("vertical", "cuadrado", "horizontal")
                : in.formats().stream().filter(FORMATS::contains).collect(Collectors.toCollection(LinkedHashSet::new)).stream().toList();
        if (formats.isEmpty()) throw ApiException.badRequest("Elige al menos un formato");
        if (callouts && !bridge.disponible()) throw ApiException.badRequest("El taller de video no está disponible en este servidor.");
        // los borradores no graban: solo los pedidos al estudio cuentan para el tope
        long jobs = active().stream().map(PromoVideo::getJobId).distinct().count();
        if (!callouts && jobs >= MAX_ACTIVE_JOBS) throw ApiException.conflict("Ya hay " + MAX_ACTIVE_JOBS + " pedidos en proceso. Espera a que terminen.");
        PromoVideo first = null;
        List<PromoVideo> rows = new java.util.ArrayList<>();
        for (String fmt : formats) {
            PromoVideo v = new PromoVideo();
            v.setCreatedBy(by);
            v.setKind(in.kind());
            v.setFormat(fmt);
            v.setVoice(in.voice());
            v.setMusic(in.music());
            v.setIdea(in.idea() == null || in.idea().isBlank() ? null : in.idea().trim());
            v.setDetail("En cola");
            if (first == null) {
                first = repo.saveAndFlush(v);
                first.setJobId(String.valueOf(first.getId()));
                v = first;
            } else {
                v.setJobId(first.getJobId());
            }
            rows.add(repo.save(v));
        }
        repo.flush();
        if (callouts) {
            for (PromoVideo v : rows) draft(v);
        } else {
            studio.submit(first.getJobId(), first, formats);
        }
        return rows.stream().map(this::row).toList();
    }

    /** Deja el video como borrador con el guion de la plantilla (la idea es el subtítulo de la intro). */
    private void draft(PromoVideo v) {
        ObjectNode spec = VideoSpecValidator.brindixTemplate();
        spec.put("format", BRIDGE_FORMAT.get(v.getFormat()));
        if (v.getIdea() != null) spec.with("intro").put("sub", v.getIdea().length() > 90 ? v.getIdea().substring(0, 90) : v.getIdea());
        v.setSpec(spec.toString());
        v.setStatus(PromoVideo.Status.DRAFT);
        v.setTitle("Brindix · " + CALLOUT_NAME.get(v.getFormat()));
        v.setKindName(CALLOUT_NAME.get(v.getFormat()) + " · Con recuadros y mascota");
        v.setDetail("Borrador: revisa y corrige");
        repo.save(v);
    }

    private PromoVideo callouts(Long id) {
        PromoVideo v = repo.findById(id).orElseThrow(() -> ApiException.notFound("Ese video no existe"));
        if (!KIND_CALLOUTS.equals(v.getKind())) throw ApiException.badRequest("Este video no tiene guion editable.");
        return v;
    }

    @Transactional
    public VideoRow saveSpec(Long id, JsonNode spec) {
        PromoVideo v = callouts(id);
        if (v.getStatus() != PromoVideo.Status.DRAFT && v.getStatus() != PromoVideo.Status.REVIEW)
            throw ApiException.conflict("Solo se edita el borrador o la previa lista.");
        ObjectNode clean = VideoSpecValidator.parse(spec);
        // el formato lo fija el registro, no el editor
        clean.put("format", BRIDGE_FORMAT.get(v.getFormat()));
        v.setSpec(clean.toString());
        if (v.getStatus() == PromoVideo.Status.REVIEW) {
            if (bridge.disponible()) {
                try { bridge.deleteFile(v.getId()); } catch (RuntimeException ignored) { }
            }
            v.setStatus(PromoVideo.Status.DRAFT);
            v.setDetail("Borrador: revisa y corrige");
        }
        return row(repo.save(v));
    }

    @Transactional
    public VideoRow preview(Long id) {
        PromoVideo v = callouts(id);
        if (v.getStatus() != PromoVideo.Status.DRAFT) throw ApiException.conflict("Solo se graba la previa desde el borrador.");
        sendRender(v, true);
        v.setStatus(PromoVideo.Status.PREVIEWING);
        v.setDetail("Grabando versión previa");
        return row(repo.save(v));
    }

    @Transactional
    public VideoRow approve(Long id) {
        PromoVideo v = callouts(id);
        if (v.getStatus() != PromoVideo.Status.REVIEW) throw ApiException.conflict("Primero graba y revisa la versión previa.");
        long jobs = active().stream().map(PromoVideo::getJobId).distinct().count();
        if (jobs >= MAX_ACTIVE_JOBS) throw ApiException.conflict("Ya hay " + MAX_ACTIVE_JOBS + " pedidos en proceso. Espera a que terminen.");
        sendRender(v, false);
        v.setStatus(PromoVideo.Status.RUNNING);
        v.setDetail("Grabando la versión final");
        return row(repo.save(v));
    }

    private void sendRender(PromoVideo v, boolean preview) {
        if (v.getSpec() == null) throw ApiException.badRequest("Este video no tiene guion.");
        if (!bridge.disponible()) throw ApiException.badRequest("El taller de video no está disponible en este servidor.");
        bridge.render(v.getId(), v.getSpec(), preview);
    }

    /** MP4 de la previa en streaming (quien lo recibe lo cierra). */
    public java.io.InputStream openPreview(Long id) {
        PromoVideo v = callouts(id);
        if (v.getStatus() != PromoVideo.Status.REVIEW) throw ApiException.notFound("No hay versión previa para este video.");
        return bridge.openFile(v.getId());
    }

    public JsonNode studioAssets() {
        if (!bridge.disponible()) return json.createArrayNode();
        try {
            return bridge.assets();
        } catch (RuntimeException e) {
            return json.createArrayNode();
        }
    }

    /** Consulta al puente; al terminar sube el MP4 a Spaces y lo borra del servidor. */
    private void pollBridge(PromoVideo v) {
        try {
            JsonNode st = bridge.status(v.getId());
            String state = st.path("state").asText("");
            if ("error".equals(state)) {
                fail(List.of(v), st.path("detail").asText("No se pudo grabar el video"));
            } else if ("done".equals(state) && v.getStatus() == PromoVideo.Status.PREVIEWING) {
                v.setStatus(PromoVideo.Status.REVIEW);
                v.setDetail("Versión previa lista");
                repo.save(v);
            } else if ("done".equals(state)) {
                java.nio.file.Path tmp = java.nio.file.Files.createTempFile("brindix-video-", ".mp4");
                try {
                    bridge.downloadFile(v.getId(), tmp);
                    v.setVideoUrl(storage.saveVideo("videos", "video-" + v.getId() + "-" + System.currentTimeMillis() + ".mp4", tmp));
                } finally {
                    java.nio.file.Files.deleteIfExists(tmp);
                }
                try { bridge.deleteFile(v.getId()); } catch (RuntimeException ignored) { }
                v.setStatus(PromoVideo.Status.DONE);
                v.setProgress(100);
                v.setDetail("Listo");
                v.setTitle("Brindix · " + CALLOUT_NAME.get(v.getFormat()));
                v.setKindName(CALLOUT_NAME.get(v.getFormat()) + " · Con recuadros y mascota");
                v.setFinishedAt(Instant.now());
                repo.save(v);
            } else if (v.getCreatedAt().plus(MAX_RUN).isBefore(Instant.now())) {
                fail(List.of(v), "Tardó demasiado y se canceló.");
            }
        } catch (Exception e) {
            log.warn("Video {}: no se pudo consultar el grabador: {}", v.getId(), e.getMessage());
            if (v.getCreatedAt().plus(MAX_RUN).isBefore(Instant.now())) fail(List.of(v), "El grabador no respondió. Vuelve a intentarlo.");
        }
    }

    @Transactional
    public void delete(Long id) {
        PromoVideo v = repo.findById(id).orElseThrow(() -> ApiException.notFound("Ese video no existe"));
        if (KIND_CALLOUTS.equals(v.getKind())) {
            if (bridge.disponible() && v.getStatus() != PromoVideo.Status.DONE) {
                try { bridge.deleteFile(v.getId()); } catch (RuntimeException ignored) { }
            }
        } else if (v.getJobId() != null) studio.delete(v.getJobId(), v.getFormat());
        repo.delete(v);
    }

    /** Reintenta un video fallido con los mismos datos (solo ese formato). */
    @Transactional
    public List<VideoRow> retry(Long by, Long id) {
        PromoVideo old = repo.findById(id).orElseThrow(() -> ApiException.notFound("Ese video no existe"));
        if (old.getStatus() != PromoVideo.Status.FAILED) throw ApiException.badRequest("Solo se reintentan los videos que fallaron");
        List<VideoRow> made = create(by, new VideoCreate(old.getKind(), List.of(old.getFormat()), old.getVoice(), old.getMusic(), old.getIdea()));
        repo.delete(old);
        return made;
    }

    /** Cada 8 s pregunta al estudio por los pedidos en proceso. */
    @Scheduled(fixedDelay = 8000, initialDelay = 15000)
    @Transactional
    public void poll() {
        List<PromoVideo> bridged = new java.util.ArrayList<>(active());
        bridged.addAll(repo.findByStatusIn(List.of(PromoVideo.Status.PREVIEWING)));
        for (PromoVideo v : bridged) if (KIND_CALLOUTS.equals(v.getKind()) && bridge.disponible()) pollBridge(v);
        if (!studio.enabled()) return;
        Map<String, List<PromoVideo>> byJob = active().stream().filter(v -> !KIND_CALLOUTS.equals(v.getKind())).collect(Collectors.groupingBy(v -> v.getJobId() == null ? String.valueOf(v.getId()) : v.getJobId()));
        for (Map.Entry<String, List<PromoVideo>> e : byJob.entrySet()) {
            List<PromoVideo> rows = e.getValue();
            Instant created = rows.get(0).getCreatedAt();
            JsonNode st = studio.status(e.getKey());
            if (st == null) {
                if (created.plus(MAX_RUN).isBefore(Instant.now())) fail(rows, "El estudio se reinició antes de terminar. Vuelve a intentarlo.");
                continue;
            }
            String status = st.path("status").asText("");
            switch (status) {
                case "DONE" -> done(rows, st.path("result"));
                case "FAILED" -> fail(rows, st.path("detail").asText("No se pudo armar el video"));
                default -> {
                    for (PromoVideo v : rows) {
                        v.setStatus("RUNNING".equals(status) ? PromoVideo.Status.RUNNING : PromoVideo.Status.QUEUED);
                        v.setProgress(st.path("progress").asInt(v.getProgress()));
                        v.setDetail(st.path("detail").asText(v.getDetail()));
                    }
                    if (created.plus(MAX_RUN).isBefore(Instant.now())) fail(rows, "Tardó demasiado y se canceló.");
                    repo.saveAll(rows);
                }
            }
        }
    }

    private void done(List<PromoVideo> rows, JsonNode r) {
        for (PromoVideo v : rows) {
            JsonNode mine = null;
            for (JsonNode x : r.path("videos")) if (v.getFormat().equals(x.path("format").asText())) mine = x;
            if (mine == null) {
                fail(List.of(v), "El estudio no entregó el formato " + v.getFormat());
                continue;
            }
            v.setStatus(PromoVideo.Status.DONE);
            v.setProgress(100);
            v.setDetail("Listo");
            v.setTitle(r.path("title").asText(null));
            v.setCaption(r.path("caption").asText(null));
            v.setKindName(r.path("kindName").asText(null));
            v.setVideoUrl(mine.path("videoUrl").asText(null));
            v.setPosterUrl(mine.path("posterUrl").asText(null));
            v.setSeconds(mine.path("seconds").isNumber() ? mine.path("seconds").asDouble() : null);
            v.setScript(r.path("script").isMissingNode() ? null : r.path("script").toString());
            v.setFinishedAt(Instant.now());
            repo.save(v);
        }
    }

    private void fail(List<PromoVideo> rows, String why) {
        for (PromoVideo v : rows) {
            log.warn("Video {} ({}) falló: {}", v.getId(), v.getFormat(), why);
            v.setStatus(PromoVideo.Status.FAILED);
            v.setDetail(why);
            v.setFinishedAt(Instant.now());
        }
        repo.saveAll(rows);
    }

    private VideoRow row(PromoVideo v) {
        JsonNode script = null;
        if (v.getScript() != null) {
            try {
                script = json.readTree(v.getScript());
            } catch (Exception ignored) {
                // guion ilegible: se muestra sin él
            }
        }
        JsonNode spec = null;
        if (KIND_CALLOUTS.equals(v.getKind()) && v.getSpec() != null) {
            try {
                spec = json.readTree(v.getSpec());
            } catch (Exception ignored) {
                // guion ilegible: se muestra sin él
            }
        }
        return new VideoRow(v.getId(), v.getJobId(), v.getKind(), v.getKindName(), v.getFormat(), v.getVoice(), v.getMusic(), v.getIdea(),
                v.getStatus(), v.getProgress(), v.getDetail(), v.getTitle(), v.getCaption(), script,
                v.getVideoUrl(), v.getPosterUrl(), v.getSeconds(), v.getCreatedAt(), v.getFinishedAt(), spec);
    }
}
