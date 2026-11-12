package com.brindix.security;

import com.brindix.staff.Role;

/**
 * Usuario autenticado en esta solicitud. venueId es null para el súper administrador.
 * support = el súper administrador entró al bar como su administrador (modo soporte).
 */
public record StaffPrincipal(Long id, Long venueId, String username, String name, Role role, boolean support) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
