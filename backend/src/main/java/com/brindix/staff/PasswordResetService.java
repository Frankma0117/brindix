package com.brindix.staff;

import com.brindix.audit.AuditService;
import com.brindix.common.ApiException;
import com.brindix.common.MailService;
import com.brindix.common.OneTimeCode;
import com.brindix.security.LoginGuard;
import com.brindix.security.StaffPrincipal;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import com.brindix.venue.VenueService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Recuperación de contraseña sin correo:
 * 1. el usuario la pide desde el ingreso (respuesta siempre igual, no revela si existe);
 * 2. otro administrador del bar o el súper administrador la aprueba y recibe un código de un solo uso
 *    (8 caracteres, 30 minutos, se guarda solo su SHA-256);
 * 3. el usuario escribe el código y su nueva contraseña. Se cierran todas sus sesiones abiertas.
 */
@Service
public class PasswordResetService {

    private static final Set<PasswordReset.Status> OPEN = Set.of(PasswordReset.Status.PENDING, PasswordReset.Status.APPROVED);
    private static final Duration CODE_TTL = Duration.ofMinutes(30);
    private static final Duration REQUEST_TTL = Duration.ofHours(24);
    private static final int MAX_ATTEMPTS = 5;
    public static final String GENERIC = "Si el usuario existe, te enviamos un código a tu correo o le avisamos al administrador del bar para que te lo dé.";

    private final PasswordResetRepository resets;
    private final StaffUserRepository users;
    private final VenueService venues;
    private final VenueRepository venueRepo;
    private final PasswordEncoder encoder;
    private final LoginGuard guard;
    private final AuditService audit;
    private final MailService mail;
    private final com.brindix.common.AppProperties props;

    public PasswordResetService(PasswordResetRepository resets, StaffUserRepository users, VenueService venues,
                                VenueRepository venueRepo, PasswordEncoder encoder, LoginGuard guard, AuditService audit,
                                MailService mail, com.brindix.common.AppProperties props) {
        this.resets = resets;
        this.users = users;
        this.venues = venues;
        this.venueRepo = venueRepo;
        this.encoder = encoder;
        this.guard = guard;
        this.audit = audit;
        this.mail = mail;
        this.props = props;
    }

    public record ForgotInput(@NotBlank String venue, @NotBlank @Size(max = 160) String username) {}

    public record ResetInput(@NotBlank String venue, @NotBlank @Size(max = 160) String username,
                             @NotBlank @Size(max = 20) String code, @NotBlank @Size(min = 8, max = 100) String next) {}

    public record RequestView(Long id, Long venueId, String venueName, String userName, String username, Role role,
                              PasswordReset.Status status, Instant requestedAt, String approvedBy, Instant expiresAt,
                              boolean mine) {}

    public record ApprovedCode(String code, Instant expiresAt, String userName, String username) {}

    /** Paso 1: el usuario pide recuperar. Siempre responde lo mismo. */
    @Transactional
    public void request(ForgotInput in, String ip) {
        String ipKey = "forgot-ip:" + ip;
        guard.check(ipKey);
        guard.failed(ipKey); // cuenta solicitudes por IP: 5 cada 15 minutos
        Venue venue = venues.bySlug(in.venue());
        StaffUser u = find(venue.getId(), in.username());
        if (u == null || !u.isActive()) return;
        Instant now = Instant.now();
        List<PasswordReset> open = resets.findByUserIdAndStatusIn(u.getId(), OPEN);
        if (open.stream().anyMatch(r -> r.getStatus() == PasswordReset.Status.PENDING && r.getRequestedAt().isAfter(now.minus(REQUEST_TTL)))) return;
        open.forEach(r -> close(r, PasswordReset.Status.EXPIRED));
        PasswordReset r = new PasswordReset();
        r.setVenueId(venue.getId());
        r.setUserId(u.getId());
        r.setRequestedIp(ip == null ? null : ip.substring(0, Math.min(ip.length(), 64)));
        resets.save(r);
        String link = props.publicBase() + "/" + venue.getSlug() + "/recuperar?codigo=1";
        if (u.getEmail() != null && !u.getEmail().isBlank() && mail.enabled()) {
            // Tiene correo: el código le llega directo (la prueba es tener acceso a su buzón).
            String code = OneTimeCode.generate();
            approveWith(r, code, "Correo de " + u.getName());
            mail.send(u.getEmail(), "Tu código para recuperar la contraseña · " + venue.getName(),
                    "Recupera tu contraseña",
                    List.of("Hola " + u.getName() + ". Pediste recuperar tu contraseña de " + venue.getName() + " en Brindix.",
                            "Escribe este código en «Ya tengo un código». Vence en 30 minutos y sirve una sola vez."),
                    OneTimeCode.pretty(code), "Escribir el código", link);
            audit.log(as(u), venue.getId(), "Pidió recuperar su contraseña", "user", u.getId(), "Código enviado a su correo · desde " + ip);
            return;
        }
        audit.log(as(u), venue.getId(), "Pidió recuperar su contraseña", "user", u.getId(), "Desde " + ip);
        // Sin correo: avisar a quienes pueden aprobar (otros administradores del bar y Brindix).
        List<String> to = new java.util.ArrayList<>(users.findByVenueIdAndRoleOrderByIdAsc(venue.getId(), Role.ADMIN).stream()
                .filter(a -> a.isActive() && !a.getId().equals(u.getId()) && a.getEmail() != null).map(StaffUser::getEmail).toList());
        if (u.getRole() == Role.ADMIN || to.isEmpty()) to.add(mail.adminEmail());
        String admin = props.publicBase() + "/" + venue.getSlug() + "/admin/equipo";
        for (String email : to.stream().filter(java.util.Objects::nonNull).distinct().toList()) {
            mail.send(email, u.getName() + " pide recuperar su contraseña · " + venue.getName(),
                    "Solicitud de recuperación de contraseña",
                    List.of(u.getName() + " (" + u.getUsername() + ", " + (u.getRole() == Role.ADMIN ? "administrador" : "mesero") + ") pidió recuperar su contraseña en " + venue.getName() + ".",
                            "Si confirmas que es esa persona, apruébala en Equipo (o en la plataforma de Brindix) y dale el código de un solo uso. Si no la reconoces, recházala."),
                    null, "Revisar la solicitud", admin);
        }
    }

    /** Solicitudes abiertas de un bar (administrador) o de todos (súper administrador, venueId null). */
    @Transactional
    public List<RequestView> list(StaffPrincipal me) {
        List<PasswordReset> rs = me.venueId() == null
                ? resets.findByStatusInOrderByRequestedAtDesc(OPEN)
                : resets.findByVenueIdAndStatusInOrderByRequestedAtDesc(me.venueId(), OPEN);
        Instant now = Instant.now();
        rs.stream().filter(r -> expired(r, now)).forEach(r -> close(r, PasswordReset.Status.EXPIRED));
        List<PasswordReset> live = rs.stream().filter(r -> OPEN.contains(r.getStatus())).toList();
        Map<Long, StaffUser> byId = users.findAllById(live.stream().map(PasswordReset::getUserId).toList()).stream()
                .collect(Collectors.toMap(StaffUser::getId, Function.identity()));
        Map<Long, String> venueNames = venueRepo.findAllById(live.stream().map(PasswordReset::getVenueId).distinct().toList()).stream()
                .collect(Collectors.toMap(Venue::getId, Venue::getName));
        return live.stream().map(r -> {
            StaffUser u = byId.get(r.getUserId());
            return new RequestView(r.getId(), r.getVenueId(), venueNames.get(r.getVenueId()), u.getName(), u.getUsername(), u.getRole(),
                    r.getStatus(), r.getRequestedAt(), r.getApprovedBy(), r.getExpiresAt(), me.venueId() != null && u.getId().equals(me.id()));
        }).toList();
    }

    /** Paso 2: aprobar. Devuelve el código una sola vez; aprobar de nuevo genera otro y anula el anterior. */
    @Transactional
    public ApprovedCode approve(StaffPrincipal me, Long id) {
        PasswordReset r = owned(me, id);
        StaffUser u = users.findById(r.getUserId()).orElseThrow(() -> ApiException.notFound("Usuario no encontrado"));
        if (me.venueId() != null && !me.support() && u.getId().equals(me.id())) {
            throw ApiException.forbidden("No puedes aprobar tu propia solicitud: pídesela a otro administrador o a Brindix");
        }
        if (!u.isActive()) throw ApiException.badRequest("El usuario está desactivado");
        String code = OneTimeCode.generate();
        approveWith(r, code, me.name());
        audit.log(me, r.getVenueId(), "Aprobó recuperar contraseña", "user", u.getId(), u.getName() + " · código válido 30 minutos");
        return new ApprovedCode(OneTimeCode.pretty(code), r.getExpiresAt(), u.getName(), u.getUsername());
    }

    private static void approveWith(PasswordReset r, String code, String by) {
        Instant now = Instant.now();
        r.setStatus(PasswordReset.Status.APPROVED);
        r.setCodeHash(OneTimeCode.hash(code));
        r.setAttempts(0);
        r.setApprovedBy(by);
        r.setApprovedAt(now);
        r.setExpiresAt(now.plus(CODE_TTL));
    }

    @Transactional
    public void reject(StaffPrincipal me, Long id) {
        PasswordReset r = owned(me, id);
        close(r, PasswordReset.Status.REJECTED);
        audit.log(me, r.getVenueId(), "Rechazó recuperar contraseña", "user", r.getUserId(), null);
    }

    /** Paso 3: el usuario usa el código y elige su nueva contraseña. */
    @Transactional
    public void reset(ResetInput in, String ip) {
        Venue venue = venues.bySlug(in.venue());
        String key = "reset:" + venue.getId() + ":" + in.username().trim().toLowerCase();
        guard.check(key);
        guard.check("reset-ip:" + ip);
        StaffUser u = find(venue.getId(), in.username());
        PasswordReset r = u == null ? null
                : resets.findFirstByUserIdAndStatusOrderByApprovedAtDesc(u.getId(), PasswordReset.Status.APPROVED).orElse(null);
        boolean ok = r != null && u.isActive() && !expired(r, Instant.now()) && OneTimeCode.matches(in.code(), r.getCodeHash());
        if (!ok) {
            guard.failed(key);
            guard.failed("reset-ip:" + ip);
            if (r != null) {
                r.setAttempts(r.getAttempts() + 1);
                if (r.getAttempts() >= MAX_ATTEMPTS) close(r, PasswordReset.Status.EXPIRED);
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "El código no es válido o ya venció. Pide uno nuevo al administrador.");
        }
        guard.ok(key);
        u.setPasswordHash(encoder.encode(in.next()));
        u.setMustChangePassword(false);
        u.setTokenVersion(u.getTokenVersion() + 1); // cierra todas sus sesiones
        close(r, PasswordReset.Status.USED);
        audit.log(as(u), venue.getId(), "Restableció su contraseña", "user", u.getId(), "Código aprobado por " + r.getApprovedBy());
        if (u.getEmail() != null) {
            mail.send(u.getEmail(), "Tu contraseña de " + venue.getName() + " cambió", "Tu contraseña cambió",
                    List.of("Hola " + u.getName() + ". Acabas de elegir una contraseña nueva en " + venue.getName() + ". Cerramos tus sesiones en otros dispositivos.",
                            "Si no fuiste tú, avisa de inmediato al administrador del bar."), null, null, null);
        }
    }

    /** Por usuario o, si escribió un correo, por el correo registrado (solo si es de una sola persona del bar). */
    private StaffUser find(Long venueId, String userOrEmail) {
        String v = userOrEmail.trim();
        StaffUser u = users.findByVenueIdAndUsernameIgnoreCase(venueId, v).orElse(null);
        if (u == null && v.contains("@")) {
            List<StaffUser> byEmail = users.findByVenueIdAndEmailIgnoreCaseAndActiveTrue(venueId, v);
            if (byEmail.size() == 1) u = byEmail.get(0);
        }
        return u;
    }

    private PasswordReset owned(StaffPrincipal me, Long id) {
        PasswordReset r = resets.findById(id).filter(x -> me.venueId() == null || x.getVenueId().equals(me.venueId()))
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada"));
        if (!OPEN.contains(r.getStatus()) || expired(r, Instant.now())) throw ApiException.badRequest("La solicitud ya no está abierta");
        return r;
    }

    private static boolean expired(PasswordReset r, Instant now) {
        return (r.getStatus() == PasswordReset.Status.APPROVED && r.getExpiresAt() != null && r.getExpiresAt().isBefore(now))
                || (r.getStatus() == PasswordReset.Status.PENDING && r.getRequestedAt().isBefore(now.minus(REQUEST_TTL)));
    }

    private static void close(PasswordReset r, PasswordReset.Status status) {
        r.setStatus(status);
        r.setCodeHash(null);
        r.setClosedAt(Instant.now());
    }

    private static StaffPrincipal as(StaffUser u) {
        return new StaffPrincipal(u.getId(), u.getVenueId(), u.getUsername(), u.getName(), u.getRole(), false);
    }
}
