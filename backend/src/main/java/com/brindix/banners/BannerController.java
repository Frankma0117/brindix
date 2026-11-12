package com.brindix.banners;

import com.brindix.music.MusicDtos;
import com.brindix.music.MusicService;
import com.brindix.security.CurrentUser;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueDtos;
import com.brindix.venue.VenueService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class BannerController {

    private final BannerService service;
    private final VenueService venues;
    private final MusicService music;

    public BannerController(BannerService service, VenueService venues, MusicService music) {
        this.service = service;
        this.venues = venues;
        this.music = music;
    }

    /** player solo viene si la pantalla trae la llave correcta y el bar usa YouTube. */
    public record ScreenView(VenueDtos.PublicVenue venue, MusicDtos.QueueView music, List<BannerService.BannerView> banners,
                             MusicDtos.PlayerCommand player, boolean controller) {}

    /** Todo lo que necesita la pantalla del bar en una sola llamada. */
    @GetMapping("/api/public/{slug}/screen")
    public ScreenView screen(@PathVariable String slug, @RequestParam(required = false) String key) {
        Venue v = venues.bySlug(slug);
        boolean controller = key != null && key.equals(v.getScreenKey());
        if (controller) music.screenAlive(v.getId());
        MusicDtos.PlayerCommand player = controller ? music.playerCommand(v) : null;
        return new ScreenView(VenueDtos.PublicVenue.of(v), music.queue(v, false), service.list(v.getId(), true), player, controller);
    }

    @PostMapping("/api/public/{slug}/screen/ended")
    public void ended(@PathVariable String slug, @RequestBody Map<String, Object> body) {
        Venue v = venues.bySlug(slug);
        Object key = body.get("key");
        Object song = body.get("songId");
        if (key != null && key.equals(v.getScreenKey()) && song instanceof Number n) {
            music.playerEnded(v, n.longValue());
        }
    }

    /** Token para que la pantalla del TV suene con Spotify (solo con su llave). */
    @GetMapping("/api/public/{slug}/screen/spotify")
    public MusicDtos.ScreenSpotify spotify(@PathVariable String slug, @RequestParam String key) {
        Venue v = venues.bySlug(slug);
        if (!key.equals(v.getScreenKey())) throw com.brindix.common.ApiException.forbidden("Llave de pantalla inválida");
        music.screenAlive(v.getId());
        return music.screenSpotify(v);
    }

    /** La pantalla ya es un reproductor de Spotify: se le pasa la música. */
    @PostMapping("/api/public/{slug}/screen/spotify/ready")
    public void spotifyReady(@PathVariable String slug, @RequestBody Map<String, Object> body) {
        Venue v = venues.bySlug(slug);
        if (!String.valueOf(body.get("key")).equals(v.getScreenKey()) || !(body.get("deviceId") instanceof String id)) {
            throw com.brindix.common.ApiException.forbidden("Llave de pantalla inválida");
        }
        music.screenReady(v, id);
    }

    @GetMapping("/api/public/{slug}/banners")
    public List<BannerService.BannerView> live(@PathVariable String slug) {
        return service.list(venues.bySlug(slug).getId(), true);
    }

    @GetMapping("/api/admin/banners")
    public List<BannerService.BannerView> list() {
        return service.list(CurrentUser.venueId(), false);
    }

    @PostMapping("/api/admin/banners")
    public void create(@Valid @RequestBody BannerService.BannerInput in) {
        service.save(CurrentUser.venueId(), null, in);
    }

    @PutMapping("/api/admin/banners/{id}")
    public void update(@PathVariable Long id, @Valid @RequestBody BannerService.BannerInput in) {
        service.save(CurrentUser.venueId(), id, in);
    }

    @DeleteMapping("/api/admin/banners/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.venueId(), id);
    }
}
