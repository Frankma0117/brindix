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

/**
 * Lee "Authorization: Bearer ..." y carga el usuario desde la base en cada solicitud:
 * un usuario desactivado, o un bar suspendido, pierde el acceso al instante.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final StaffUserRepository staff;
    private final PlatformUserRepository platform;
    private final VenueRepository venues;

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
        if (header != null && header.startsWith("Bearer ")) {
            jwt.parse(header.substring(7)).ifPresent(sub -> {
                if (sub.kind() == JwtService.Kind.PLATFORM) {
                    platform.findById(sub.id()).filter(u -> u.isActive()).ifPresent(u -> authenticate(
                            new StaffPrincipal(u.getId(), null, u.getUsername(), u.getName(), Role.SUPERADMIN),
                            List.of(new SimpleGrantedAuthority("ROLE_SUPERADMIN"))));
                } else {
                    staff.findById(sub.id()).filter(u -> u.isActive())
                            .filter(u -> venues.findById(u.getVenueId()).map(v -> v.isActive()).orElse(false))
                            .ifPresent(u -> authenticate(
                                    new StaffPrincipal(u.getId(), u.getVenueId(), u.getUsername(), u.getName(), u.getRole()),
                                    u.getRole() == Role.ADMIN
                                            ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_WAITER"))
                                            : List.of(new SimpleGrantedAuthority("ROLE_WAITER"))));
                }
            });
        }
        chain.doFilter(req, res);
    }

    private static void authenticate(StaffPrincipal p, List<SimpleGrantedAuthority> roles) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p, null, roles));
    }
}
