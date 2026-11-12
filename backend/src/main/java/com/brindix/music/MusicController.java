package com.brindix.music;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.brindix.security.CurrentUser;
import com.brindix.security.JwtService;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
public class MusicController {

    private static final Logger log = LoggerFactory.getLogger(MusicController.class);

    private final MusicService music;
    private final SpotifyClient spotify;
    private final SpotifyAccountService accounts;
    private final VenueService venues;
    private final JwtService jwt;
    private final AppProperties props;

    public MusicController(MusicService music, SpotifyClient spotify, SpotifyAccountService accounts,
                           VenueService venues, JwtService jwt, AppProperties props) {
        this.music = music;
        this.spotify = spotify;
        this.accounts = accounts;
        this.venues = venues;
        this.jwt = jwt;
        this.props = props;
    }

    // ---------- Cliente ----------

    @GetMapping("/api/public/{slug}/music/queue")
    public MusicDtos.QueueView publicQueue(@PathVariable String slug) {
        return music.queue(venues.bySlug(slug), false);
    }

    @GetMapping("/api/public/{slug}/music/search")
    public List<MusicDtos.Track> search(@PathVariable String slug, @RequestParam String q) {
        return music.search(venues.bySlug(slug), q);
    }

    @PostMapping("/api/public/{slug}/tables/{code}/songs")
    public MusicDtos.SongView request(@PathVariable String slug, @PathVariable String code, @Valid @RequestBody MusicDtos.SongInput in) {
        return music.clientRequest(slug, code, in);
    }

    // ---------- Administrador ----------

    @GetMapping("/api/admin/music/queue")
    public MusicDtos.QueueView adminQueue() {
        return music.queue(venues.get(CurrentUser.venueId()), true);
    }

    @GetMapping("/api/admin/music/history")
    public List<MusicDtos.SongView> history(@RequestParam(defaultValue = "12") int hours) {
        return music.history(CurrentUser.venueId(), hours);
    }

    @GetMapping("/api/admin/music/search")
    public List<MusicDtos.Track> adminSearch(@RequestParam String q) {
        return music.search(venues.get(CurrentUser.venueId()), q);
    }

    @PostMapping("/api/admin/music/songs")
    public MusicDtos.SongView add(@Valid @RequestBody MusicDtos.SongInput in, @RequestParam(defaultValue = "false") boolean next) {
        return music.adminAdd(CurrentUser.get(), in, next);
    }

    @PostMapping("/api/admin/music/songs/{id}/{action}")
    public void action(@PathVariable Long id, @PathVariable String action) {
        Long venueId = CurrentUser.venueId();
        switch (action) {
            case "approve" -> music.approve(venueId, id);
            case "reject", "remove" -> music.reject(venueId, id);
            case "top" -> music.prioritize(venueId, id);
            case "up" -> music.move(venueId, id, -1);
            case "down" -> music.move(venueId, id, 1);
            case "pin" -> music.togglePin(venueId, id);
            default -> throw ApiException.badRequest("Acción desconocida");
        }
    }

    @PostMapping("/api/admin/music/next")
    public void next() {
        music.next(CurrentUser.venueId());
    }

    @PostMapping("/api/admin/music/stop")
    public void stop() {
        music.stop(CurrentUser.venueId());
    }

    // ---------- Spotify (cuenta del bar) ----------

    @GetMapping("/api/admin/spotify/authorize")
    public java.util.Map<String, String> authorize() {
        Venue v = venues.get(CurrentUser.venueId());
        return java.util.Map.of("url", accounts.authorizeUrl(v, jwt.issueState(v.getId())));
    }

    /** Spotify redirige aquí después de que el administrador acepta. */
    @GetMapping("/api/spotify/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(required = false) String error) {
        String result = "error";
        Long venueId = jwt.parseState(state).orElse(null);
        String slug = venueId == null ? "" : venues.get(venueId).getSlug();
        if (error == null && code != null && venueId != null) {
            try {
                accounts.connect(venueId, code);
                result = "ok";
            } catch (Exception e) {
                log.warn("No se pudo conectar Spotify: {}", e.getMessage());
            }
        }
        HttpHeaders h = new HttpHeaders();
        h.setLocation(URI.create(props.publicBase() + "/" + slug + "/admin/configuracion?spotify=" + result));
        return new ResponseEntity<>(h, HttpStatus.FOUND);
    }

    @PostMapping("/api/admin/spotify/disconnect")
    public void disconnect() {
        accounts.disconnect(CurrentUser.venueId());
    }

    @PostMapping("/api/admin/spotify/player/{action}")
    public void player(@PathVariable String action) {
        String token = accounts.requireToken(CurrentUser.venueId());
        switch (action) {
            case "pause" -> spotify.pause(token);
            case "play" -> spotify.play(token);
            default -> throw ApiException.badRequest("Acción desconocida");
        }
    }
}
