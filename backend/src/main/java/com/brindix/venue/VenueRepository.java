package com.brindix.venue;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {

    Optional<Venue> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Venue> findAllByOrderByNameAsc();

    List<Venue> findByActiveTrueAndMusicProviderAndSpotifyRefreshTokenIsNotNull(Venue.MusicProvider provider);
}
