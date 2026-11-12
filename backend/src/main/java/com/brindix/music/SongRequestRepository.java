package com.brindix.music;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SongRequestRepository extends JpaRepository<SongRequest, Long> {

    List<SongRequest> findByVenueIdAndStatusInOrderByPositionAscIdAsc(Long venueId, Collection<SongStatus> statuses);

    Optional<SongRequest> findFirstByVenueIdAndStatusOrderByPositionAscIdAsc(Long venueId, SongStatus status);

    List<SongRequest> findByVenueIdAndStatus(Long venueId, SongStatus status);

    long countByTableIdAndStatusIn(Long tableId, Collection<SongStatus> statuses);

    @Query("select coalesce(max(s.position), 0) from SongRequest s where s.venueId = :venueId and s.status in (com.brindix.music.SongStatus.PENDING, com.brindix.music.SongStatus.QUEUED)")
    long maxPosition(Long venueId);

    @Query("select coalesce(min(s.position), 0) from SongRequest s where s.venueId = :venueId and s.status = com.brindix.music.SongStatus.QUEUED")
    long minQueuedPosition(Long venueId);

    @Query("select s from SongRequest s where s.venueId = :venueId and s.status = com.brindix.music.SongStatus.PLAYED and s.finishedAt >= :since order by s.finishedAt desc")
    List<SongRequest> recentlyPlayed(Long venueId, Instant since);
}
