package com.brindix.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop50ByVenueIdOrderByCreatedAtDescIdDesc(Long venueId);

    long countByVenueIdAndReadAtIsNull(Long venueId);

    boolean existsByVenueIdAndDedupeKey(Long venueId, String dedupeKey);

    List<Notification> findByVenueIdAndReadAtIsNull(Long venueId);

    @Modifying
    @Query("delete from Notification n where n.readAt is not null and n.readAt < :before")
    int deleteReadBefore(Instant before);
}
