package com.brindix.venue;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.brindix.common.Codes;
import com.brindix.common.Crypto;
import com.brindix.uploads.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VenueService {

    private final VenueRepository venues;
    private final Crypto crypto;
    private final AppProperties props;
    private final StorageService storage;

    public VenueService(VenueRepository venues, Crypto crypto, AppProperties props, StorageService storage) {
        this.venues = venues;
        this.crypto = crypto;
        this.props = props;
        this.storage = storage;
    }

    /** Bar activo por su dirección (lo usan las páginas públicas). */
    @Transactional(readOnly = true)
    public Venue bySlug(String slug) {
        return venues.findBySlug(slug == null ? "" : slug.trim().toLowerCase())
                .filter(Venue::isActive)
                .orElseThrow(() -> ApiException.notFound("Este bar no existe o no está activo"));
    }

    @Transactional(readOnly = true)
    public Venue get(Long id) {
        return venues.findById(id).orElseThrow(() -> ApiException.notFound("Bar no encontrado"));
    }

    @Transactional(readOnly = true)
    public VenueDtos.AdminVenue admin(Long id) {
        return adminView(get(id));
    }

    @Transactional
    public VenueDtos.AdminVenue update(Long id, VenueDtos.VenueUpdate in) {
        Venue v = get(id);
        v.setName(in.name().trim());
        v.setTagline(blank(in.tagline()));
        v.setLogoUrl(blank(in.logoUrl()));
        v.setWifiName(blank(in.wifiName()));
        v.setWifiPassword(blank(in.wifiPassword()));
        v.setClientOrdersEnabled(in.clientOrdersEnabled());
        v.setWaiterCanCharge(in.waiterCanCharge());
        v.setMusicEnabled(in.musicEnabled());
        v.setSongApproval(in.songApproval());
        v.setMaxSongsPerTable(Math.max(1, Math.min(20, in.maxSongsPerTable())));
        return adminView(v);
    }

    @Transactional
    public VenueDtos.AdminVenue updateMusic(Long id, VenueDtos.MusicConfig in) {
        Venue v = get(id);
        if (in.clearSpotify()) {
            v.setSpotifyClientId(null);
            v.setSpotifyClientSecret(null);
            clearSpotifyTokens(v);
        } else {
            String newId = blank(in.spotifyClientId());
            if (newId != null && !newId.equals(v.getSpotifyClientId())) {
                v.setSpotifyClientId(newId);
                clearSpotifyTokens(v); // otra app: hay que volver a conectar la cuenta
            }
            if (blank(in.spotifyClientSecret()) != null) v.setSpotifyClientSecret(crypto.encrypt(in.spotifyClientSecret().trim()));
        }
        if (in.clearYoutube()) v.setYoutubeApiKey(null);
        else if (blank(in.youtubeApiKey()) != null) v.setYoutubeApiKey(crypto.encrypt(in.youtubeApiKey().trim()));

        if (in.provider() != null) {
            if (in.provider() == Venue.MusicProvider.SPOTIFY && (v.getSpotifyClientId() == null || v.getSpotifyClientSecret() == null)) {
                throw ApiException.badRequest("Para usar Spotify primero guarda el Client ID y el Client secret de tu app");
            }
            if (in.provider() == Venue.MusicProvider.YOUTUBE && v.getYoutubeApiKey() == null) {
                throw ApiException.badRequest("Para usar YouTube primero guarda la API key");
            }
            v.setMusicProvider(in.provider());
        }
        return adminView(v);
    }

    @Transactional
    public VenueDtos.AdminVenue regenerateScreenKey(Long id) {
        Venue v = get(id);
        v.setScreenKey(Codes.random(20));
        return adminView(v);
    }

    public String spotifySecret(Venue v) {
        return crypto.decrypt(v.getSpotifyClientSecret());
    }

    public String youtubeKey(Venue v) {
        return crypto.decrypt(v.getYoutubeApiKey());
    }

    static void clearSpotifyTokens(Venue v) {
        v.setSpotifyAccessToken(null);
        v.setSpotifyRefreshToken(null);
        v.setSpotifyExpiresAt(null);
        v.setSpotifyAccount(null);
    }

    private VenueDtos.AdminVenue adminView(Venue v) {
        VenueDtos.Integrations i = new VenueDtos.Integrations(v.getSpotifyClientId(),
                Crypto.mask(crypto.decrypt(v.getSpotifyClientSecret())), v.spotifyConnected(), v.getSpotifyAccount(),
                props.spotifyRedirectUri(), Crypto.mask(crypto.decrypt(v.getYoutubeApiKey())), props.ai().enabled(),
                storage.mode(), props.publicBase() + "/" + v.getSlug());
        return new VenueDtos.AdminVenue(v.getId(), v.getSlug(), v.getName(), v.getTagline(), v.getLogoUrl(), v.getCurrency(),
                v.getWifiName(), v.getWifiPassword(), v.isClientOrdersEnabled(), v.isWaiterCanCharge(), v.isMusicEnabled(),
                v.isSongApproval(), v.getMaxSongsPerTable(), v.getMusicProvider(), v.getScreenKey(), i);
    }

    static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
