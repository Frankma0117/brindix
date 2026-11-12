package com.brindix.music;

import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Cada 5 segundos pregunta a Spotify qué suena en cada bar conectado y alimenta la cola. */
@Component
public class SpotifySyncJob {

    private static final Logger log = LoggerFactory.getLogger(SpotifySyncJob.class);

    private final VenueRepository venues;
    private final MusicService music;

    public SpotifySyncJob(VenueRepository venues, MusicService music) {
        this.venues = venues;
        this.music = music;
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 8000)
    public void tick() {
        for (Venue v : venues.findByActiveTrueAndMusicProviderAndSpotifyRefreshTokenIsNotNull(Venue.MusicProvider.SPOTIFY)) {
            try {
                music.syncSpotify(v.getId());
            } catch (Exception e) {
                log.debug("Sync Spotify bar {}: {}", v.getSlug(), e.getMessage());
            }
        }
    }
}
