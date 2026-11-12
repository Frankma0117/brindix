package com.brindix.music;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.brindix.common.Crypto;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import com.brindix.venue.VenueService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** Guarda (cifrados) y renueva los tokens de Spotify de cada bar. */
@Service
public class SpotifyAccountService {

    private final VenueRepository venues;
    private final VenueService venueService;
    private final SpotifyClient spotify;
    private final Crypto crypto;
    private final AppProperties props;

    public SpotifyAccountService(VenueRepository venues, VenueService venueService, SpotifyClient spotify, Crypto crypto, AppProperties props) {
        this.venues = venues;
        this.venueService = venueService;
        this.spotify = spotify;
        this.crypto = crypto;
        this.props = props;
    }

    public SpotifyClient.Credentials credentials(Venue v) {
        String secret = venueService.spotifySecret(v);
        if (v.getSpotifyClientId() == null || secret == null) return null;
        return new SpotifyClient.Credentials(v.getSpotifyClientId(), secret);
    }

    public String authorizeUrl(Venue v, String state) {
        SpotifyClient.Credentials c = credentials(v);
        if (c == null) throw ApiException.badRequest("Primero guarda el Client ID y el Client secret de tu app de Spotify");
        return spotify.authorizeUrl(c, props.spotifyRedirectUri(), state);
    }

    @Transactional
    public void connect(Long venueId, String code) {
        Venue v = venues.findById(venueId).orElseThrow(() -> ApiException.notFound("Bar no encontrado"));
        SpotifyClient.Tokens t = spotify.exchangeCode(credentials(v), code, props.spotifyRedirectUri());
        v.setSpotifyAccessToken(crypto.encrypt(t.accessToken()));
        v.setSpotifyRefreshToken(crypto.encrypt(t.refreshToken()));
        v.setSpotifyExpiresAt(Instant.now().plusSeconds(t.expiresIn()));
        v.setSpotifyAccount(spotify.accountName(t.accessToken()));
    }

    @Transactional
    public void disconnect(Long venueId) {
        venues.findById(venueId).ifPresent(v -> {
            v.setSpotifyAccessToken(null);
            v.setSpotifyRefreshToken(null);
            v.setSpotifyExpiresAt(null);
            v.setSpotifyAccount(null);
        });
    }

    /** Token de acceso vigente o null si el bar no tiene Spotify conectado. Renueva si vence pronto. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public String accessToken(Long venueId) {
        Venue v = venues.findById(venueId).orElse(null);
        if (v == null || !v.spotifyConnected()) return null;
        SpotifyClient.Credentials c = credentials(v);
        if (c == null) return null;
        if (v.getSpotifyAccessToken() != null && v.getSpotifyExpiresAt() != null
                && Instant.now().isBefore(v.getSpotifyExpiresAt().minusSeconds(90))) {
            return crypto.decrypt(v.getSpotifyAccessToken());
        }
        String refresh = crypto.decrypt(v.getSpotifyRefreshToken());
        if (refresh == null) return null;
        try {
            SpotifyClient.Tokens t = spotify.refresh(c, refresh);
            v.setSpotifyAccessToken(crypto.encrypt(t.accessToken()));
            v.setSpotifyRefreshToken(crypto.encrypt(t.refreshToken()));
            v.setSpotifyExpiresAt(Instant.now().plusSeconds(t.expiresIn()));
            return t.accessToken();
        } catch (SpotifyClient.SpotifyAuthException e) {
            v.setSpotifyAccessToken(null);
            v.setSpotifyRefreshToken(null);
            v.setSpotifyExpiresAt(null);
            throw e;
        }
    }

    public String requireToken(Long venueId) {
        String token = accessToken(venueId);
        if (token == null) throw ApiException.conflict("Spotify no está conectado. Conéctalo en Configuración → Música.");
        return token;
    }
}
