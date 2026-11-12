package com.brindix.security;

import com.brindix.staff.Role;

/** Usuario autenticado en esta solicitud. venueId es null para el súper administrador. */
public record StaffPrincipal(Long id, Long venueId, String username, String name, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
