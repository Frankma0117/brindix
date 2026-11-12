package com.brindix.platform;

import com.brindix.common.AppProperties;
import com.brindix.security.CurrentUser;
import com.brindix.staff.StaffDtos;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class PlatformController {

    private final PlatformService service;
    private final AppProperties props;

    public PlatformController(PlatformService service, AppProperties props) {
        this.service = service;
        this.props = props;
    }

    @PostMapping("/api/platform/login")
    public PlatformService.LoginResponse login(@Valid @RequestBody PlatformService.LoginRequest in) {
        return service.login(in);
    }

    @GetMapping("/api/platform/venues")
    public List<PlatformService.VenueRow> venues() {
        return service.list();
    }

    @PostMapping("/api/platform/venues")
    public PlatformService.VenueRow create(@Valid @RequestBody PlatformService.VenueCreate in) {
        return service.create(in);
    }

    @PutMapping("/api/platform/venues/{id}")
    public PlatformService.VenueRow update(@PathVariable Long id, @Valid @RequestBody PlatformService.VenueUpdate in) {
        return service.update(id, in);
    }

    @PostMapping("/api/platform/password")
    public void changePassword(@Valid @RequestBody StaffDtos.PasswordChange in) {
        service.changePassword(CurrentUser.get(), in);
    }

    /** Modo soporte: entrar al bar como su administrador. */
    @PostMapping("/api/platform/venues/{id}/enter")
    public StaffDtos.LoginResponse enter(@PathVariable Long id) {
        return service.enter(CurrentUser.get(), id);
    }

    @PostMapping("/api/platform/venues/{id}/reset-admin")
    public void reset(@PathVariable Long id, @Valid @RequestBody PlatformService.ResetPassword in) {
        service.resetAdmin(id, in);
    }

    /** Datos públicos de contacto para la landing. */
    @GetMapping("/api/public/site")
    public Map<String, String> site() {
        return Map.of("whatsapp", props.whatsapp() == null ? "" : props.whatsapp(),
                "demoUrl", props.demoUrl() == null ? "" : props.demoUrl());
    }
}
