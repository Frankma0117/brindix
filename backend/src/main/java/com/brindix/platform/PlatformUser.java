package com.brindix.platform;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Súper administrador de Brindix (el dueño del servicio). */
@Entity
@Table(name = "platform_users")
@Getter
@Setter
public class PlatformUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String username;
    private String passwordHash;
    private boolean active = true;
    private Instant createdAt = Instant.now();
    private Instant lastLoginAt;
    /** Clave inicial o puesta por otra persona: debe cambiarla al entrar. */
    private boolean mustChangePassword;
    /** Sube al cambiar o restablecer la contraseña: los tokens con otra versión dejan de valer. */
    private int tokenVersion;
}
