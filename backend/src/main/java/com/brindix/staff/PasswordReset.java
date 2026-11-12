package com.brindix.staff;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Solicitud de recuperación de contraseña de un usuario de un bar. */
@Entity
@Table(name = "password_resets")
@Getter
@Setter
public class PasswordReset {

    public enum Status { PENDING, APPROVED, USED, REJECTED, EXPIRED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long userId;

    @Enumerated(EnumType.STRING)
    private Status status = Status.PENDING;

    /** SHA-256 del código de un solo uso (nunca se guarda el código). */
    private String codeHash;
    private int attempts;
    private Instant requestedAt = Instant.now();
    private String requestedIp;
    private String approvedBy;
    private Instant approvedAt;
    private Instant expiresAt;
    private Instant closedAt;
}
