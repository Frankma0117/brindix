package com.brindix.music;

import com.brindix.venue.Venue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class MusicDtos {

    private MusicDtos() {}

    /** Resultado de búsqueda (Spotify o YouTube). ref = uri de Spotify o id de video. */
    public record Track(Venue.MusicProvider provider, String ref, String title, String artist, String album, String image,
                        Integer durationMs, boolean explicit) {}

    public record SongInput(@NotBlank @Size(max = 200) String title, @Size(max = 200) String artist,
                            @Size(max = 200) String ref, @Size(max = 500) String albumImage,
                            Integer durationMs, @Size(max = 80) String requestedBy) {}

    public record SongView(Long id, Venue.MusicProvider provider, String ref, String title, String artist, String albumImage,
                           Integer durationMs, String requestedBy, String tableName, SongStatus status, boolean pinned,
                           boolean sentToPlayer, Instant createdAt, Instant startedAt) {}

    /** Lo que suena: viene de Spotify si está conectado, o de la cola (manual / YouTube). */
    public record NowPlaying(String title, String artist, String image, Integer durationMs, Integer progressMs,
                             boolean playing, String requestedBy, String tableName, boolean fromRequest, Instant updatedAt) {}

    public record QueueView(Venue.MusicProvider provider, NowPlaying nowPlaying, List<SongView> upNext, List<SongView> pending,
                            boolean spotifyConnected, boolean searchEnabled) {}

    /** Instrucción para el reproductor de la pantalla (solo YouTube y con la llave de pantalla). */
    public record PlayerCommand(Long songId, String videoId, String title) {}
}
