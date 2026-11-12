package com.brindix.venue;

import com.brindix.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class VenueController {

    private final VenueService service;

    public VenueController(VenueService service) {
        this.service = service;
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/api/public/{slug}/venue")
    public VenueDtos.PublicVenue publicVenue(@PathVariable String slug) {
        return VenueDtos.PublicVenue.of(service.bySlug(slug));
    }

    @GetMapping("/api/admin/venue")
    public VenueDtos.AdminVenue get() {
        return service.admin(CurrentUser.venueId());
    }

    @PutMapping("/api/admin/venue")
    public VenueDtos.AdminVenue update(@Valid @RequestBody VenueDtos.VenueUpdate in) {
        return service.update(CurrentUser.venueId(), in);
    }

    @PutMapping("/api/admin/venue/music")
    public VenueDtos.AdminVenue music(@Valid @RequestBody VenueDtos.MusicConfig in) {
        return service.updateMusic(CurrentUser.venueId(), in);
    }

    @PostMapping("/api/admin/venue/screen-key")
    public VenueDtos.AdminVenue screenKey() {
        return service.regenerateScreenKey(CurrentUser.venueId());
    }
}
