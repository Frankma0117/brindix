package com.brindix.orders;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** La cuenta de una mesa. Se paga por rondas o completa; se cierra al liberar la mesa. */
@Entity
@Table(name = "tabs")
@Getter
@Setter
public class Tab {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long tableId;

    @Enumerated(EnumType.STRING)
    private TabStatus status = TabStatus.OPEN;

    private String customerName;
    private String notes;
    /** Mesero responsable de la mesa. */
    private Long waiterId;
    private Long openedBy;
    private Long closedBy;
    private Instant openedAt = Instant.now();
    private Instant closedAt;
}
