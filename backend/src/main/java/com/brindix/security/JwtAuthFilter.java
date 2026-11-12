package com.brindix.security;

import com.brindix.platform.PlatformUserRepository;
import com.brindix.staff.Role;
import com.brindix.staff.StaffUserRepository;
import com.brindix.venue.VenueRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Set;

/**
 * Lee "Authorization: Bearer ..." y carga el usuario desde la base en cada solicitud:
 * un usuario desactivado, o un bar suspendido, pierde el acceso al instante.
 * Quien tiene una clave inicial solo puede cambiarla hasta que lo haga.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final StaffUserRepository staff;
    private final PlatformUserRepository platform;
    private final VenueRepository venues;

    /** Lo único que se permite mientras la clave inicial no se haya cambiado. */
    private static final Set<String> WHILE_MUST_CHANGE = Set.of("/api/auth/me", "/api/auth/password", "/api/platform/password");

    public JwtAuthFilter(JwtService jwt, StaffUserRepository staff, PlatformUserRepository platform, VenueRepository venues) {
        this.jwt = jwt;
        this.staff = staff;
        this.platform = platform;
        this.venues = venues;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        boolean[] mustChange = {false};
        if (header != null && header.startsWith("Bearer ")) {
            jwt.parse(header.substring(7)).ifPresent(sub -> {
                if (sub.kind() == JwtService.Kind.PLATFORM) {
                    platform.findById(sub.id()).filter(u -> u.isActive()).ifPresent(u -> {
                        mustChange[0] = u.isMustChangePassword();
                        authenticate(new StaffPrincipal(u.getId(), null, u.getUsername(), u.getName(), Role.SUPERADMIN, false),
                                List.of(new SimpleGrantedAuthority("ROLE_SUPERADMIN")));
                    });
                } else if (sub.kind() == JwtService.Kind.SUPPORT) {
                    platform.findById(sub.supportBy()).filter(p -> p.isActive()).ifPresent(p ->
                            staff.findById(sub.id()).filter(u -> u.isActive() && u.getRole() == Role.ADMIN)
                                    .filter(u -> venues.findById(u.getVenueId()).map(v -> v.isActive()).orElse(false))
                                    .ifPresent(u -> authenticate(
                                            new StaffPrincipal(u.getId(), u.getVenueId(), u.getUsername(), "Soporte Brindix (" + p.getName() + ")", Role.ADMIN, true),
                                            List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_WAITER")))));
                } else {
                    staff.findById(sub.id()).filter(u -> u.isActive())
                            .filter(u -> venues.findById(u.getVenueId()).map(v -> v.isActive()).orElse(false))
                            .ifPresent(u -> {
                                mustChange[0] = u.isMustChangePassword();
                                authenticate(
                                        new StaffPrincipal(u.getId(), u.getVenueId(), u.getUsername(), u.getName(), u.getRole(), false),
                                        u.getRole() == Role.ADMIN
                                                ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_WAITER"))
                                                : List.of(new SimpleGrantedAuthority("ROLE_WAITER")));
                            });
                }
            });
        }
        if (mustChange[0] && !WHILE_MUST_CHANGE.contains(req.getRequestURI())) {
            SecurityContextHolder.clearContext();
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"Debes cambiar tu contraseña antes de continuar\",\"code\":\"PASSWORD_CHANGE_REQUIRED\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    private static void authenticate(StaffPrincipal p, List<SimpleGrantedAuthority> roles) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p, null, roles));
    }
}
