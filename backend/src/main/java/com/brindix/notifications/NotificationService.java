package com.brindix.notifications;

import com.brindix.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    public record View(Long id, String type, String title, String body, String link, Instant createdAt, boolean read) {}

    public record Feed(long unread, List<View> items) {}

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    /**
     * Crea un aviso si no existe ya uno con la misma dedupeKey. Va en su propia transacción y nunca lanza:
     * un fallo aquí no debe tumbar la operación que lo origina.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void push(Long venueId, String type, String title, String body, String link, String dedupeKey) {
        try {
            if (venueId == null || dedupeKey == null || repo.existsByVenueIdAndDedupeKey(venueId, dedupeKey)) return;
            Notification n = new Notification();
            n.setVenueId(venueId);
            n.setType(type);
            n.setTitle(cut(title, 160));
            n.setBody(cut(body, 400));
            n.setLink(cut(link, 120));
            n.setDedupeKey(cut(dedupeKey, 120));
            repo.saveAndFlush(n);
        } catch (RuntimeException e) {
            log.warn("No se pudo crear el aviso {}: {}", dedupeKey, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Feed feed(Long venueId) {
        List<View> items = repo.findTop50ByVenueIdOrderByCreatedAtDescIdDesc(venueId).stream()
                .map(n -> new View(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLink(), n.getCreatedAt(), n.getReadAt() != null))
                .toList();
        return new Feed(repo.countByVenueIdAndReadAtIsNull(venueId), items);
    }

    @Transactional
    public void markRead(Long venueId, Long id) {
        Notification n = repo.findById(id).filter(x -> x.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Aviso no encontrado"));
        if (n.getReadAt() == null) n.setReadAt(Instant.now());
    }

    @Transactional
    public void markAllRead(Long venueId) {
        Instant now = Instant.now();
        repo.findByVenueIdAndReadAtIsNull(venueId).forEach(n -> n.setReadAt(now));
    }

    /** Borra los avisos leídos hace más de 30 días. */
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    public void cleanup() {
        int n = repo.deleteReadBefore(Instant.now().minus(Duration.ofDays(30)));
        if (n > 0) log.info("Avisos leídos borrados: {}", n);
    }

    private static String cut(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }
}
