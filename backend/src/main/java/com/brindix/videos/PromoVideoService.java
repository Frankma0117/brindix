package com.brindix.videos;

import com.brindix.common.ApiException;
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

    private static final Logger log = LoggerFactory.getLogger(PromoVideoService.class);
    private static final List<String> FORMATS = List.of("vertical", "horizontal", "cuadrado");
    /** Pedidos (no videos) en cola o en proceso a la vez. */
    private static final int MAX_ACTIVE_JOBS = 3;
    /** Un pedido con tres formatos tarda unos 15 minutos; si pasa esto sin terminar, se da por perdido. */
    private static final Duration MAX_RUN = Duration.ofMinutes(40);

    private final PromoVideoRepository repo;
    private final StudioClient studio;
    private final ObjectMapper json;

    public PromoVideoService(PromoVideoRepository repo, StudioClient studio, ObjectMapper json) {
        this.repo = repo;
        this.studio = studio;
        this.json = json;
    }

    public record VideoRow(Long id, String jobId, String kind, String kindName, String format, String voice, String music, String idea,
                           PromoVideo.Status status, int progress, String detail, String title, String caption, JsonNode script,
                           String videoUrl, String posterUrl, Double seconds, Instant createdAt, Instant finishedAt) {}

    public record VideoCreate(@NotBlank @Pattern(regexp = "[a-z_]+") String kind,
                              @NotEmpty List<@Pattern(regexp = "vertical|horizontal|cuadrado") String> formats,
                              @NotBlank @Pattern(regexp = "[HM][0-9]") String voice,
                              @NotBlank @Pattern(regexp = "[a-z]+") String music,
                              @Size(max = 600) String idea) {}

    public JsonNode options() {
        return studio.options();
    }

    public boolean enabled() {
        return studio.enabled();
    }

    public JsonNode voiceSample(String key) {
        if (!key.matches("[HM][0-9]")) throw ApiException.badRequest("Esa voz no existe");
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
        List<String> formats = in.formats().stream().filter(FORMATS::contains).collect(Collectors.toCollection(LinkedHashSet::new)).stream().toList();
        if (formats.isEmpty()) throw ApiException.badRequest("Elige al menos un formato");
        long jobs = active().stream().map(PromoVideo::getJobId).distinct().count();
        if (jobs >= MAX_ACTIVE_JOBS) throw ApiException.conflict("Ya hay " + MAX_ACTIVE_JOBS + " pedidos en proceso. Espera a que terminen.");
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
        studio.submit(first.getJobId(), first, formats);
        return rows.stream().map(this::row).toList();
    }

    @Transactional
    public void delete(Long id) {
        PromoVideo v = repo.findById(id).orElseThrow(() -> ApiException.notFound("Ese video no existe"));
        if (v.getJobId() != null) studio.delete(v.getJobId(), v.getFormat());
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
        if (!studio.enabled()) return;
        Map<String, List<PromoVideo>> byJob = active().stream().collect(Collectors.groupingBy(v -> v.getJobId() == null ? String.valueOf(v.getId()) : v.getJobId()));
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
        return new VideoRow(v.getId(), v.getJobId(), v.getKind(), v.getKindName(), v.getFormat(), v.getVoice(), v.getMusic(), v.getIdea(),
                v.getStatus(), v.getProgress(), v.getDetail(), v.getTitle(), v.getCaption(), script,
                v.getVideoUrl(), v.getPosterUrl(), v.getSeconds(), v.getCreatedAt(), v.getFinishedAt());
    }
}
