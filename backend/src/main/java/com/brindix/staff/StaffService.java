package com.brindix.staff;

import com.brindix.audit.AuditService;
import com.brindix.common.ApiException;
import com.brindix.security.JwtService;
import com.brindix.security.LoginGuard;
import com.brindix.security.StaffPrincipal;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class StaffService {

    private final StaffUserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginGuard guard;
    private final VenueService venues;
    private final AuditService audit;

    public StaffService(StaffUserRepository users, PasswordEncoder encoder, JwtService jwt, LoginGuard guard,
                        VenueService venues, AuditService audit) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.guard = guard;
        this.venues = venues;
        this.audit = audit;
    }

    @Transactional
    public StaffDtos.LoginResponse login(StaffDtos.LoginRequest in) {
        Venue venue = venues.bySlug(in.venue());
        String key = venue.getId() + ":" + in.username().trim().toLowerCase();
        guard.check(key);
        StaffUser u = users.findByVenueIdAndUsernameIgnoreCase(venue.getId(), in.username().trim()).orElse(null);
        if (u == null || !u.isActive() || !encoder.matches(in.password(), u.getPasswordHash())) {
            guard.failed(key);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos");
        }
        guard.ok(key);
        u.setLastLoginAt(Instant.now());
        return new StaffDtos.LoginResponse(jwt.issue(JwtService.Kind.STAFF, u.getId(), u.getTokenVersion()), StaffDtos.UserView.of(u),
                venue.getSlug(), venue.getName(), false);
    }

    @Transactional(readOnly = true)
    public StaffUser get(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("Usuario no encontrado"));
    }

    @Transactional(readOnly = true)
    public List<StaffDtos.UserView> list(Long venueId) {
        return users.findByVenueIdOrderByNameAsc(venueId).stream().map(StaffDtos.UserView::of).toList();
    }

    @Transactional(readOnly = true)
    public List<StaffDtos.WaiterOption> waiters(Long venueId) {
        return users.findByVenueIdOrderByNameAsc(venueId).stream().filter(StaffUser::isActive)
                .map(u -> new StaffDtos.WaiterOption(u.getId(), u.getName(), u.getRole())).toList();
    }

    @Transactional
    public StaffDtos.UserView create(StaffPrincipal me, StaffDtos.UserCreate in) {
        Long venueId = me.venueId();
        if (in.role() == Role.SUPERADMIN) throw ApiException.badRequest("Rol no permitido");
        if (users.existsByVenueIdAndUsernameIgnoreCase(venueId, in.username().trim())) {
            throw ApiException.conflict("Ese usuario ya existe en este bar");
        }
        StaffUser u = newUser(venueId, in.name(), in.username(), in.password(), in.role());
        audit.log(me, venueId, "Creó usuario", "user", u.getId(), u.getName() + " (" + u.getRole() + ")");
        return StaffDtos.UserView.of(u);
    }

    /** También lo usa la plataforma al crear un bar. */
    @Transactional
    public StaffUser newUser(Long venueId, String name, String username, String password, Role role) {
        StaffUser u = new StaffUser();
        u.setVenueId(venueId);
        u.setName(name.trim());
        u.setUsername(username.trim().toLowerCase());
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        u.setMustChangePassword(true);
        return users.save(u);
    }

    @Transactional
    public StaffDtos.UserView update(StaffPrincipal me, Long id, StaffDtos.UserUpdate in) {
        StaffUser u = get(id);
        if (!u.getVenueId().equals(me.venueId())) throw ApiException.notFound("Usuario no encontrado");
        if (in.role() == Role.SUPERADMIN) throw ApiException.badRequest("Rol no permitido");
        boolean losesAdmin = u.getRole() == Role.ADMIN && (in.role() != Role.ADMIN || !in.active());
        if (losesAdmin && users.countByVenueIdAndRoleAndActiveTrue(me.venueId(), Role.ADMIN) <= 1) {
            throw ApiException.conflict("Debe quedar al menos un administrador activo");
        }
        u.setName(in.name().trim());
        u.setRole(in.role());
        u.setActive(in.active());
        if (in.password() != null && !in.password().isBlank()) {
            u.setPasswordHash(encoder.encode(in.password()));
            u.setMustChangePassword(true);
            u.setTokenVersion(u.getTokenVersion() + 1); // cierra sus sesiones abiertas
        }
        audit.log(me, me.venueId(), "Editó usuario", "user", u.getId(),
                u.getName() + " · " + u.getRole() + (u.isActive() ? "" : " · desactivado") + (in.password() != null && !in.password().isBlank() ? " · nueva contraseña" : ""));
        return StaffDtos.UserView.of(u);
    }

    @Transactional
    /** Cambia la propia contraseña; cierra las demás sesiones y devuelve un token nuevo para esta. */
    public String changePassword(StaffPrincipal me, StaffDtos.PasswordChange in) {
        if (me.support()) throw ApiException.forbidden("En modo soporte no se cambia la contraseña del administrador");
        StaffUser u = get(me.id());
        if (!encoder.matches(in.current(), u.getPasswordHash())) {
            throw ApiException.badRequest("La contraseña actual no coincide");
        }
        if (in.current().equals(in.next())) throw ApiException.badRequest("La nueva contraseña debe ser distinta a la actual");
        u.setPasswordHash(encoder.encode(in.next()));
        u.setMustChangePassword(false);
        u.setTokenVersion(u.getTokenVersion() + 1);
        audit.log(me, me.venueId(), "Cambió su contraseña", "user", u.getId(), null);
        return jwt.issue(JwtService.Kind.STAFF, u.getId(), u.getTokenVersion());
    }
}
