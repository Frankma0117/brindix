package com.brindix.audit;

import com.brindix.security.StaffPrincipal;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Deja huella de los cambios delicados: anulaciones, cobros, caja, inventario, asignaciones. */
@Service
public class AuditService {

    private final AuditRepository repo;

    public AuditService(AuditRepository repo) {
        this.repo = repo;
    }

    public record AuditView(Long id, String userName, String action, String entity, Long entityId, String details, Instant createdAt) {
        static AuditView of(AuditLog a) {
            return new AuditView(a.getId(), a.getUserName(), a.getAction(), a.getEntity(), a.getEntityId(), a.getDetails(), a.getCreatedAt());
        }
    }

    @Transactional
    public void log(StaffPrincipal who, Long venueId, String action, String entity, Long entityId, String details) {
        AuditLog a = new AuditLog();
        a.setVenueId(venueId);
        a.setUserId(who == null ? null : who.id());
        a.setUserName(who == null ? "Cliente" : who.name());
        a.setAction(action);
        a.setEntity(entity);
        a.setEntityId(entityId);
        a.setDetails(details == null ? null : details.length() > 1000 ? details.substring(0, 1000) : details);
        repo.save(a);
    }

    @Transactional(readOnly = true)
    public List<AuditView> list(Long venueId, String entity, Long entityId, Instant from, int limit) {
        return repo.search(venueId, entity, entityId, from == null ? Instant.EPOCH : from, PageRequest.of(0, Math.max(1, Math.min(500, limit))))
                .stream().map(AuditView::of).toList();
    }
}
