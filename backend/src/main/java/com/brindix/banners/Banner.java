package com.brindix.banners;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "banners")
@Getter
@Setter
public class Banner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String title;
    private String subtitle;
    private String imageUrl;
    /** Paleta del banner cuando no hay imagen: amber, neon, lime, berry, ocean. */
    private String theme = "amber";
    private int durationSeconds = 10;
    private int sortOrder;
    private boolean active = true;
    private Instant startsAt;
    private Instant endsAt;
    /** Opcional: producto que se promociona (la pantalla muestra su precio). */
    private Long productId;
    private Instant createdAt = Instant.now();

    public boolean liveAt(Instant now) {
        return active && (startsAt == null || !now.isBefore(startsAt)) && (endsAt == null || now.isBefore(endsAt));
    }
}
