package com.brindix.platform;

import com.brindix.common.ApiException;
import com.brindix.common.Codes;
import com.brindix.security.JwtService;
import com.brindix.security.LoginGuard;
import com.brindix.staff.Role;
import com.brindix.staff.StaffUser;
import com.brindix.staff.StaffUserRepository;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/** Lo que hace el dueño de Brindix: crear bares, suspenderlos y darles su primer administrador. */
@Service
public class PlatformService {

    /** Direcciones que no puede usar un bar porque son rutas de la app. */
    private static final Set<String> RESERVED = Set.of("api", "uploads", "plataforma", "ingresar", "admin", "mesero",
            "pantalla", "carta", "assets", "static", "brindix", "www", "app", "login", "favicon.svg");

    private final PlatformUserRepository platformUsers;
    private final VenueRepository venues;
    private final StaffUserRepository staff;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginGuard guard;
    private final VenueStarter starter;

    public PlatformService(PlatformUserRepository platformUsers, VenueRepository venues, StaffUserRepository staff,
                           PasswordEncoder encoder, JwtService jwt, LoginGuard guard, VenueStarter starter) {
        this.platformUsers = platformUsers;
        this.venues = venues;
        this.staff = staff;
        this.encoder = encoder;
        this.jwt = jwt;
        this.guard = guard;
        this.starter = starter;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record LoginResponse(String token, String name) {}

    public record VenueRow(Long id, String name, String slug, boolean active, String contactName, String contactPhone,
                           long users, String admin, Instant createdAt) {}

    public record VenueCreate(@NotBlank @Size(max = 120) String name,
                              @NotBlank @Size(min = 3, max = 40) @Pattern(regexp = "[a-z0-9-]+", message = "solo minúsculas, números y guiones") String slug,
                              @Size(max = 120) String contactName, @Size(max = 40) String contactPhone,
                              @NotBlank @Size(max = 120) String adminName,
                              @NotBlank @Size(min = 3, max = 60) @Pattern(regexp = "[a-zA-Z0-9._-]+") String adminUsername,
                              @NotBlank @Size(min = 8, max = 100) String adminPassword,
                              boolean sampleMenu) {}

    public record VenueUpdate(@NotBlank @Size(max = 120) String name, boolean active,
                              @Size(max = 120) String contactName, @Size(max = 40) String contactPhone) {}

    public record ResetPassword(@NotBlank @Size(min = 8, max = 100) String password) {}

    @Transactional
    public LoginResponse login(LoginRequest in) {
        String key = "platform:" + in.username().trim().toLowerCase();
        guard.check(key);
        PlatformUser u = platformUsers.findByUsernameIgnoreCase(in.username().trim()).orElse(null);
        if (u == null || !u.isActive() || !encoder.matches(in.password(), u.getPasswordHash())) {
            guard.failed(key);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos");
        }
        guard.ok(key);
        u.setLastLoginAt(Instant.now());
        return new LoginResponse(jwt.issue(JwtService.Kind.PLATFORM, u.getId()), u.getName());
    }

    @Transactional(readOnly = true)
    public List<VenueRow> list() {
        return venues.findAllByOrderByNameAsc().stream().map(this::row).toList();
    }

    @Transactional
    public VenueRow create(VenueCreate in) {
        String slug = Codes.slug(in.slug());
        if (RESERVED.contains(slug)) throw ApiException.badRequest("Esa dirección está reservada, elige otra");
        if (venues.existsBySlug(slug)) throw ApiException.conflict("Ya existe un bar con esa dirección");
        Venue v = starter.create(in.name().trim(), slug, in.adminName(), in.adminUsername(), in.adminPassword(), in.sampleMenu());
        v.setContactName(blank(in.contactName()));
        v.setContactPhone(blank(in.contactPhone()));
        return row(v);
    }

    @Transactional
    public VenueRow update(Long id, VenueUpdate in) {
        Venue v = venues.findById(id).orElseThrow(() -> ApiException.notFound("Bar no encontrado"));
        v.setName(in.name().trim());
        v.setActive(in.active());
        v.setContactName(blank(in.contactName()));
        v.setContactPhone(blank(in.contactPhone()));
        return row(v);
    }

    /** Si el administrador del bar olvidó su contraseña. */
    @Transactional
    public void resetAdmin(Long venueId, ResetPassword in) {
        StaffUser admin = staff.findByVenueIdAndRoleOrderByIdAsc(venueId, Role.ADMIN).stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("El bar no tiene administrador"));
        admin.setPasswordHash(encoder.encode(in.password()));
        admin.setActive(true);
    }

    private VenueRow row(Venue v) {
        String admin = staff.findByVenueIdAndRoleOrderByIdAsc(v.getId(), Role.ADMIN).stream().findFirst()
                .map(StaffUser::getUsername).orElse(null);
        return new VenueRow(v.getId(), v.getName(), v.getSlug(), v.isActive(), v.getContactName(), v.getContactPhone(),
                staff.countByVenueId(v.getId()), admin, v.getCreatedAt());
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
