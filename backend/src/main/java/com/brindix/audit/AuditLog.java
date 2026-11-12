package com.brindix.audit;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "audit_log")
@Getter
@Setter
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long userId;
    private String userName;
    private String action;
    private String entity;
    private Long entityId;
    private String details;
    private Instant createdAt = Instant.now();
}
