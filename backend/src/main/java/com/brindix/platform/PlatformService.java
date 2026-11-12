package com.brindix.platform;

import com.brindix.audit.AuditService;
import com.brindix.common.ApiException;
import com.brindix.common.Codes;
import com.brindix.security.JwtService;
import com.brindix.security.LoginGuard;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.StaffDtos;
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
    private static final Set<String> RESERVED = Set.of("api", "uploads", "plataforma", "creditos", "demo-assets", "ingresar", "admin", "mesero",
            "pantalla", "carta", "assets", "static", "brindix", "www", "app", "login", "favicon.svg");

    private final PlatformUserRepository platformUsers;
    private final VenueRepository venues;
    private final StaffUserRepository staff;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginGuard guard;
    private final VenueStarter starter;
    private final AuditService audit;
    private final com.brindix.common.AppProperties props;
    private final com.brindix.common.MailService mail;

    public PlatformService(PlatformUserRepository platformUsers, VenueRepository venues, StaffUserRepository staff,
                           PasswordEncoder encoder, JwtService jwt, LoginGuard guard, VenueStarter starter, AuditService audit, com.brindix.common.AppProperties props,
                           com.brindix.common.MailService mail) {
        this.platformUsers = platformUsers;
        this.venues = venues;
        this.staff = staff;
        this.encoder = encoder;
        this.jwt = jwt;
        this.guard = guard;
        this.starter = starter;
        this.audit = audit;
        this.props = props;
        this.mail = mail;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record LoginResponse(String token, String name, boolean mustChangePassword) {}

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
        return new LoginResponse(jwt.issue(JwtService.Kind.PLATFORM, u.getId(), u.getTokenVersion()), u.getName(), u.isMustChangePassword());
    }

    @Transactional
    public String changePassword(StaffPrincipal me, StaffDtos.PasswordChange in) {
        PlatformUser u = platformUsers.findById(me.id()).orElseThrow(() -> ApiException.notFound("Usuario no encontrado"));
        if (!encoder.matches(in.current(), u.getPasswordHash())) throw ApiException.badRequest("La contraseña actual no coincide");
        if (in.current().equals(in.next())) throw ApiException.badRequest("La nueva contraseña debe ser distinta a la actual");
        u.setPasswordHash(encoder.encode(in.next()));
        u.setMustChangePassword(false);
        u.setTokenVersion(u.getTokenVersion() + 1);
        notifyChange(u, "desde «Mi contraseña»");
        return jwt.issue(JwtService.Kind.PLATFORM, u.getId(), u.getTokenVersion());
    }

    public record ForgotInput(@NotBlank String username) {}

    public record CodeResetInput(@NotBlank String username, @NotBlank @Size(max = 20) String code,
                                 @NotBlank @Size(min = 8, max = 100) String next) {}

    /** Olvidé mi contraseña (súper administrador): manda un código de 8 caracteres a su correo. Respuesta siempre igual. */
    @Transactional
    public void forgot(ForgotInput in, String ip) {
        String key = "pforgot:" + ip;
        guard.check(key);
        guard.failed(key); // 5 pedidos cada 15 minutos por IP
        PlatformUser u = platformUsers.findByUsernameIgnoreCase(in.username().trim()).orElse(null);
        if (u == null || !u.isActive() || u.getEmail() == null || !mail.enabled()) return;
        String code = com.brindix.common.OneTimeCode.generate();
        u.setResetCodeHash(com.brindix.common.OneTimeCode.hash(code));
        u.setResetExpiresAt(Instant.now().plus(java.time.Duration.ofMinutes(15)));
        u.setResetAttempts(0);
        mail.send(u.getEmail(), "Tu código para entrar a la plataforma de Brindix", "Recupera tu contraseña de Brindix",
                List.of("Alguien (ojalá tú) pidió recuperar la contraseña del súper administrador desde " + ip + ".",
                        "Escribe este código en la plataforma. Vence en 15 minutos y sirve una sola vez."),
                com.brindix.common.OneTimeCode.pretty(code), "Abrir la plataforma", props.publicBase() + "/plataforma");
    }

    /** Paso 2: el código del correo y la nueva contraseña. Cierra todas las sesiones. */
    @Transactional
    public void resetWithCode(CodeResetInput in, String ip) {
        String key = "preset:" + in.username().trim().toLowerCase();
        guard.check(key);
        guard.check("preset-ip:" + ip);
        PlatformUser u = platformUsers.findByUsernameIgnoreCase(in.username().trim()).orElse(null);
        boolean ok = u != null && u.isActive() && u.getResetExpiresAt() != null && u.getResetExpiresAt().isAfter(Instant.now())
                && com.brindix.common.OneTimeCode.matches(in.code(), u.getResetCodeHash());
        if (!ok) {
            guard.failed(key);
            guard.failed("preset-ip:" + ip);
            if (u != null && u.getResetCodeHash() != null) {
                u.setResetAttempts(u.getResetAttempts() + 1);
                if (u.getResetAttempts() >= 5) { u.setResetCodeHash(null); u.setResetExpiresAt(null); }
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "El código no es válido o ya venció. Pide uno nuevo.");
        }
        guard.ok(key);
        u.setPasswordHash(encoder.encode(in.next()));
        u.setMustChangePassword(false);
        u.setTokenVersion(u.getTokenVersion() + 1);
        u.setResetCodeHash(null);
        u.setResetExpiresAt(null);
        notifyChange(u, "con un código enviado a tu correo");
    }

    private void notifyChange(PlatformUser u, String how) {
        String to = u.getEmail() != null ? u.getEmail() : mail.adminEmail();
        mail.send(to, "La contraseña de la plataforma Brindix cambió", "Tu contraseña de Brindix cambió",
                List.of("La contraseña del súper administrador (" + u.getUsername() + ") se cambió " + how + ". Cerramos las demás sesiones.",
                        "Si no fuiste tú, recupera el acceso de inmediato desde la plataforma o con la clave de recuperación del servidor."),
                null, null, null);
    }

    public record RecoverInput(@NotBlank String username, @NotBlank String recoveryKey,
                               @NotBlank @Size(min = 8, max = 100) String next, boolean temporary) {}

    /**
     * El súper administrador olvidó su contraseña: se recupera con la clave BRINDIX_RECOVERY_KEY del .env del
     * servidor (prueba de que tiene acceso al servidor). Cierra todas sus sesiones.
     */
    @Transactional
    public void recover(RecoverInput in, String ip) {
        String key = "recover:" + ip;
        guard.check(key);
        guard.check("recover:all");
        String expected = props.recoveryKey();
        PlatformUser u = platformUsers.findByUsernameIgnoreCase(in.username().trim()).orElse(null);
        boolean ok = expected != null && expected.length() >= 24 && u != null && u.isActive()
                && java.security.MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        in.recoveryKey().trim().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (!ok) {
            guard.failed(key);
            guard.failed("recover:all");
            throw new ApiException(HttpStatus.BAD_REQUEST, "Usuario o clave de recuperación incorrectos");
        }
        guard.ok(key);
        u.setPasswordHash(encoder.encode(in.next()));
        u.setMustChangePassword(in.temporary());
        u.setTokenVersion(u.getTokenVersion() + 1);
        notifyChange(u, "con la clave de recuperación del servidor (desde " + ip + ")");
    }

    /**
     * Modo soporte: el súper administrador entra a cualquier bar como su administrador para revisar algo.
     * Lo que haga queda en la bitácora del bar a nombre de "Soporte Brindix".
     */
    @Transactional
    public StaffDtos.LoginResponse enter(StaffPrincipal me, Long venueId) {
        Venue v = venues.findById(venueId).orElseThrow(() -> ApiException.notFound("Bar no encontrado"));
        if (!v.isActive()) throw ApiException.badRequest("El bar está suspendido: actívalo para entrar");
        StaffUser admin = staff.findByVenueIdAndRoleOrderByIdAsc(venueId, Role.ADMIN).stream().filter(StaffUser::isActive).findFirst()
                .orElseThrow(() -> ApiException.notFound("El bar no tiene un administrador activo"));
        String name = "Soporte Brindix (" + me.name() + ")";
        audit.log(new StaffPrincipal(admin.getId(), venueId, me.username(), name, Role.ADMIN, true), venueId,
                "Entró en modo soporte", "venue", venueId, "Como " + admin.getUsername());
        var user = new StaffDtos.UserView(admin.getId(), name, admin.getUsername(), Role.ADMIN, true,
                admin.getCreatedAt(), admin.getLastLoginAt(), false, null);
        return new StaffDtos.LoginResponse(jwt.issueSupport(admin.getId(), me.id(), admin.getTokenVersion()), user, v.getSlug(), v.getName(), true);
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
        admin.setMustChangePassword(true);
        admin.setTokenVersion(admin.getTokenVersion() + 1);
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
