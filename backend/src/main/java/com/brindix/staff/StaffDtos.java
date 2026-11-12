package com.brindix.staff;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class StaffDtos {

    private StaffDtos() {}

    /** venue = dirección del bar (slug). */
    public record LoginRequest(@NotBlank String venue, @NotBlank String username, @NotBlank String password) {}

    /** support = sesión del súper administrador dentro del bar. */
    public record LoginResponse(String token, UserView user, String venue, String venueName, boolean support) {}

    public record UserView(Long id, String name, String username, Role role, boolean active,
                           Instant createdAt, Instant lastLoginAt, boolean mustChangePassword) {
        public static UserView of(StaffUser u) {
            return new UserView(u.getId(), u.getName(), u.getUsername(), u.getRole(), u.isActive(),
                    u.getCreatedAt(), u.getLastLoginAt(), u.isMustChangePassword());
        }
    }

    public record UserCreate(@NotBlank @Size(max = 120) String name,
                             @NotBlank @Size(min = 3, max = 60) @Pattern(regexp = "[a-zA-Z0-9._-]+",
                                     message = "solo letras, números, punto y guion") String username,
                             @NotBlank @Size(min = 8, max = 100) String password,
                             @NotNull Role role) {}

    public record UserUpdate(@NotBlank @Size(max = 120) String name, @NotNull Role role, boolean active,
                             @Size(min = 8, max = 100) String password) {}

    public record PasswordChange(@NotBlank String current, @NotBlank @Size(min = 8, max = 100) String next) {}

    /** Para asignar pedidos: meseros activos del bar. */
    public record WaiterOption(Long id, String name, Role role) {}
}
