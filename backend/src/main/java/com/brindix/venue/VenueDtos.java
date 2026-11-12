package com.brindix.venue;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class VenueDtos {

    private VenueDtos() {}

    /** Lo que ve cualquiera (login del bar, carta, pantalla). Nunca incluye claves. */
    public record PublicVenue(String slug, String name, String tagline, String logoUrl, String currency,
                              String wifiName, String wifiPassword, boolean musicEnabled, Venue.MusicProvider musicProvider,
                              boolean clientOrdersEnabled, int maxSongsPerTable) {
        public static PublicVenue of(Venue v) {
            return new PublicVenue(v.getSlug(), v.getName(), v.getTagline(), v.getLogoUrl(), v.getCurrency(),
                    v.getWifiName(), v.getWifiPassword(), v.isMusicEnabled(), v.getMusicProvider(),
                    v.isClientOrdersEnabled(), v.getMaxSongsPerTable());
        }
    }

    /** Configuración completa para el administrador del bar. Las claves solo se muestran enmascaradas. */
    public record AdminVenue(Long id, String slug, String name, String tagline, String logoUrl, String currency,
                             String wifiName, String wifiPassword, boolean clientOrdersEnabled, boolean waiterCanCharge,
                             boolean musicEnabled, boolean songApproval, int maxSongsPerTable,
                             Venue.MusicProvider musicProvider, String screenKey, Integrations integrations) {}

    public record Integrations(String spotifyClientId, String spotifyClientSecret, boolean spotifyConnected,
                               String spotifyAccount, String spotifyRedirectUri, String youtubeApiKey,
                               boolean aiEnabled, String storage, String publicUrl) {}

    public record VenueUpdate(@NotBlank @Size(max = 120) String name,
                              @Size(max = 200) String tagline,
                              @Size(max = 500) String logoUrl,
                              @Size(max = 80) String wifiName,
                              @Size(max = 80) String wifiPassword,
                              boolean clientOrdersEnabled,
                              boolean waiterCanCharge,
                              boolean musicEnabled,
                              boolean songApproval,
                              int maxSongsPerTable) {}

    /**
     * Música del bar. Las claves vacías no cambian lo guardado; para borrar una se manda clear*=true.
     */
    public record MusicConfig(Venue.MusicProvider provider,
                              @Size(max = 120) String spotifyClientId,
                              @Size(max = 200) String spotifyClientSecret,
                              @Size(max = 200) String youtubeApiKey,
                              boolean clearSpotify,
                              boolean clearYoutube) {}
}
