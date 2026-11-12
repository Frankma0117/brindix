package com.brindix.security;

import com.brindix.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    private CurrentUser() {}

    public static StaffPrincipal get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof StaffPrincipal p) {
            return p;
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "Debes iniciar sesión");
    }

    /** Bar del usuario actual (falla para el súper administrador, que no pertenece a un bar). */
    public static Long venueId() {
        Long id = get().venueId();
        if (id == null) throw new ApiException(HttpStatus.FORBIDDEN, "Esta acción es de un bar");
        return id;
    }
}
