package com.brindix.videos;

import com.brindix.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class PromoVideoService {

    private static final Logger log = LoggerFactory.getLogger(PromoVideoService.class);
    /** Un video tarda 2 a 6 minutos; si pasa esto sin terminar, se da por perdido. */
    private static final Duration MAX_RUN = Duration.ofMinutes(25);

    private final PromoVideoRepository repo;
    private final StudioClient studio;
    private final ObjectMapper json;

    public PromoVideoService(PromoVideoRepository repo, StudioClient studio, ObjectMapper json) {
        this.repo = repo;
        this.studio = studio;
        this.json = json;
    }

    public record VideoRow(Long id, String kind, String kindName, String format, String voice, String music, String idea,
                           PromoVideo.Status status, int progress, String detail, String title, String caption, JsonNode script,
                           String videoUrl, String posterUrl, Double seconds, Instant createdAt, Instant finishedAt) {}

    public record VideoCreate(@NotBlank @Pattern(regexp = "[a-z_]+") String kind,
                              @NotBlank @Pattern(regexp = "vertical|horizontal|cuadrado") String format,
                              @NotBlank @Pattern(regexp = "[HM][0-9]") String voice,
                              @NotBlank @Pattern(regexp = "[a-z]+") String music,
                              @Size(max = 600) String idea) {}

    public JsonNode options() {
        return studio.options();
    }

    public boolean enabled() {
        return studio.enabled();
    }

    public List<VideoRow> list() {
        return repo.findAllByOrderByIdDesc().stream().map(this::row).toList();
    }

    @Transactional
    public VideoRow create(Long by, VideoCreate in) {
        long active = repo.findByStatusIn(List.of(PromoVideo.Status.QUEUED, PromoVideo.Status.RUNNING)).size();
        if (active >= 3) throw ApiException.conflict("Ya hay 3 videos en proceso. Espera a que terminen.");
        PromoVideo v = new PromoVideo();
        v.setCreatedBy(by);
        v.setKind(in.kind());
        v.setFormat(in.format());
        v.setVoice(in.voice());
        v.setMusic(in.music());
        v.setIdea(in.idea() == null ? null : in.idea().trim());
        v.setDetail("En cola");
        v = repo.saveAndFlush(v);
        studio.submit(v);
        return row(v);
    }

    @Transactional
    public void delete(Long id) {
        PromoVideo v = repo.findById(id).orElseThrow(() -> ApiException.notFound("Ese video no existe"));
        studio.delete(id);
        repo.delete(v);
    }

    /** Reintenta un video fallido con los mismos datos. */
    @Transactional
    public VideoRow retry(Long by, Long id) {
        PromoVideo old = repo.findById(id).orElseThrow(() -> ApiException.notFound("Ese video no existe"));
        if (old.getStatus() != PromoVideo.Status.FAILED) throw ApiException.badRequest("Solo se reintentan los videos que fallaron");
        return create(by, new VideoCreate(old.getKind(), old.getFormat(), old.getVoice(), old.getMusic(), old.getIdea()));
    }

    /** Cada 8 s pregunta al estudio por los videos en proceso. */
    @Scheduled(fixedDelay = 8000, initialDelay = 15000)
    @Transactional
    public void poll() {
        if (!studio.enabled()) return;
        for (PromoVideo v : repo.findByStatusIn(List.of(PromoVideo.Status.QUEUED, PromoVideo.Status.RUNNING))) {
            JsonNode st = studio.status(v.getId());
            if (st == null) {
                if (v.getCreatedAt().plus(MAX_RUN).isBefore(Instant.now())) {
                    fail(v, "El estudio se reinició antes de terminar. Vuelve a intentarlo.");
                }
                continue;
            }
            String status = st.path("status").asText("");
            switch (status) {
                case "DONE" -> {
                    JsonNode r = st.path("result");
                    v.setStatus(PromoVideo.Status.DONE);
                    v.setProgress(100);
                    v.setDetail("Listo");
                    v.setTitle(r.path("title").asText(null));
                    v.setCaption(r.path("caption").asText(null));
                    v.setKindName(r.path("kindName").asText(null));
                    v.setVideoUrl(r.path("videoUrl").asText(null));
                    v.setPosterUrl(r.path("posterUrl").asText(null));
                    v.setSeconds(r.path("seconds").isNumber() ? r.path("seconds").asDouble() : null);
                    v.setScript(r.path("script").isMissingNode() ? null : r.path("script").toString());
                    v.setFinishedAt(Instant.now());
                }
                case "FAILED" -> fail(v, st.path("detail").asText("No se pudo armar el video"));
                default -> {
                    v.setStatus("RUNNING".equals(status) ? PromoVideo.Status.RUNNING : PromoVideo.Status.QUEUED);
                    v.setProgress(st.path("progress").asInt(v.getProgress()));
                    v.setDetail(st.path("detail").asText(v.getDetail()));
                    if (v.getCreatedAt().plus(MAX_RUN).isBefore(Instant.now())) fail(v, "Tardó demasiado y se canceló.");
                }
            }
            repo.save(v);
        }
    }

    private void fail(PromoVideo v, String why) {
        log.warn("Video {} falló: {}", v.getId(), why);
        v.setStatus(PromoVideo.Status.FAILED);
        v.setDetail(why);
        v.setFinishedAt(Instant.now());
        repo.save(v);
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
        return new VideoRow(v.getId(), v.getKind(), v.getKindName(), v.getFormat(), v.getVoice(), v.getMusic(), v.getIdea(),
                v.getStatus(), v.getProgress(), v.getDetail(), v.getTitle(), v.getCaption(), script,
                v.getVideoUrl(), v.getPosterUrl(), v.getSeconds(), v.getCreatedAt(), v.getFinishedAt());
    }
}
