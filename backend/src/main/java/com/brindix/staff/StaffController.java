package com.brindix.staff;

import com.brindix.security.CurrentUser;
import com.brindix.venue.VenueService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class StaffController {

    private final StaffService service;
    private final VenueService venues;

    public StaffController(StaffService service, VenueService venues) {
        this.service = service;
        this.venues = venues;
    }

    @PostMapping("/api/auth/login")
    public StaffDtos.LoginResponse login(@Valid @RequestBody StaffDtos.LoginRequest in) {
        return service.login(in);
    }

    /** Quién soy y en qué bar (sirve para validar la sesión guardada). */
    @GetMapping("/api/auth/me")
    public Map<String, Object> me() {
        var me = CurrentUser.get();
        if (me.venueId() == null) return Map.of("user", me);
        var v = venues.get(me.venueId());
        return Map.of("user", StaffDtos.UserView.of(service.get(me.id())), "venue", v.getSlug(), "venueName", v.getName());
    }

    @PostMapping("/api/auth/password")
    public Map<String, String> changePassword(@Valid @RequestBody StaffDtos.PasswordChange in) {
        return Map.of("token", service.changePassword(CurrentUser.get(), in));
    }

    @GetMapping("/api/staff/waiters")
    public List<StaffDtos.WaiterOption> waiters() {
        return service.waiters(CurrentUser.venueId());
    }

    @GetMapping("/api/admin/users")
    public List<StaffDtos.UserView> list() {
        return service.list(CurrentUser.venueId());
    }

    @PostMapping("/api/admin/users")
    public StaffDtos.UserView create(@Valid @RequestBody StaffDtos.UserCreate in) {
        return service.create(CurrentUser.get(), in);
    }

    @PutMapping("/api/admin/users/{id}")
    public StaffDtos.UserView update(@PathVariable Long id, @Valid @RequestBody StaffDtos.UserUpdate in) {
        return service.update(CurrentUser.get(), id, in);
    }
}
