package com.brindix.notifications;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Aviso para el administrador del bar. dedupeKey evita repetir el mismo aviso. */
@Entity
@Table(name = "notifications")
@Getter
@Setter
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String type;
    private String title;
    private String body;
    private String link;
    private Instant createdAt = Instant.now();
    private Instant readAt;
    private String dedupeKey;
}
