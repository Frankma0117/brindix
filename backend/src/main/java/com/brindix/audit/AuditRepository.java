package com.brindix.audit;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface AuditRepository extends JpaRepository<AuditLog, Long> {

    @Query("select a from AuditLog a where a.venueId = :venueId and (:entity is null or a.entity = :entity) and (:entityId is null or a.entityId = :entityId) and a.createdAt >= :from order by a.createdAt desc, a.id desc")
    List<AuditLog> search(Long venueId, String entity, Long entityId, Instant from, Pageable page);
}
