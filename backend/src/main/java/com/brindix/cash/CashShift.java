package com.brindix.cash;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Turno de caja: se abre con la base (dinero inicial) y se cierra contando el efectivo. */
@Entity
@Table(name = "cash_shifts")
@Getter
@Setter
public class CashShift {

    public enum Status { OPEN, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;

    @Enumerated(EnumType.STRING)
    private Status status = Status.OPEN;

    private Long openedBy;
    private Instant openedAt = Instant.now();
    private BigDecimal openingCash;
    private String openingNote;
    private Long closedBy;
    private Instant closedAt;
    private BigDecimal expectedCash;
    private BigDecimal countedCash;
    private BigDecimal difference;
    private String closingNote;
}
