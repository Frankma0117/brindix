package com.brindix.publisher;

import com.brindix.videos.PromoVideo;
import com.brindix.videos.PromoVideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Cada minuto envía al publicador los videos que el estudio terminó y todavía no se enviaron. Si el publicador
 * está caído se reintenta solo en el siguiente ciclo; los que no tienen una dirección https pública se saltan.
 */
@Component
public class PublisherSync {

    private static final Logger log = LoggerFactory.getLogger(PublisherSync.class);

    private final PublisherClient publisher;
    private final PromoVideoRepository repo;

    public PublisherSync(PublisherClient publisher, PromoVideoRepository repo) {
        this.publisher = publisher;
        this.repo = repo;
    }

    static String formatLabel(String format) {
        if (format == null) return "";
        return switch (format) {
            case "vertical" -> " · vertical";
            case "landscape" -> " · horizontal";
            case "square" -> " · cuadrado";
            default -> " · " + format;
        };
    }

    @Scheduled(fixedDelay = 60000, initialDelay = 45000)
    @Transactional
    public void push() {
        if (!publisher.enabled()) return;
        List<PromoVideo> todo = repo.findByStatusAndPublisherSentFalseOrderByIdAsc(PromoVideo.Status.DONE);
        for (PromoVideo v : todo) {
            String url = v.getVideoUrl();
            if (url == null || !url.startsWith("https://")) continue; // en desarrollo los archivos son locales
            try {
                String title = (v.getTitle() == null || v.getTitle().isBlank() ? "Video de Brindix" : v.getTitle()) + formatLabel(v.getFormat());
                publisher.push(url, title, v.getCaption(), "promo-video-" + v.getId(), v.getPosterUrl());
                v.setPublisherSent(true);
                repo.save(v);
            } catch (Exception e) {
                log.warn("No se pudo enviar el video {} al publicador: {}", v.getId(), e.getMessage());
                return; // si el publicador no responde, no insistir con los demás hasta el próximo ciclo
            }
        }
    }
}
