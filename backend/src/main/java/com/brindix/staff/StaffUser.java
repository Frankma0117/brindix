package com.brindix.staff;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "staff_users")
@Getter
@Setter
public class StaffUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String name;
    /** Único dentro del bar (dos bares pueden tener un "admin"). */
    private String username;
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private Role role;

    private boolean active = true;
    private Instant createdAt = Instant.now();
    private Instant lastLoginAt;
    /** Clave inicial o puesta por otra persona: debe cambiarla al entrar. */
    private boolean mustChangePassword;
    /** Sube al cambiar o restablecer la contraseña: los tokens con otra versión dejan de valer. */
    private int tokenVersion;
}
