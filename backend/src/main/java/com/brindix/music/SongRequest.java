package com.brindix.music;

import com.brindix.venue.Venue;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "song_requests")
@Getter
@Setter
public class SongRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long tableId;

    @Enumerated(EnumType.STRING)
    private Venue.MusicProvider provider = Venue.MusicProvider.MANUAL;

    /** uri de Spotify (spotify:track:...) o id del video de YouTube. */
    private String trackRef;
    private String title;
    private String artist;
    private String albumImage;
    private Integer durationMs;
    private String requestedBy;

    @Enumerated(EnumType.STRING)
    private SongStatus status;

    /** Orden en la cola: menor suena antes. */
    private long position;
    private boolean pinned;
    /** Ya se mandó a la cola de Spotify (desde ahí no se puede reordenar). */
    private boolean sentToPlayer;
    private Instant createdAt = Instant.now();
    private Instant startedAt;
    private Instant finishedAt;
}
