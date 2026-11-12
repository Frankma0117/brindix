package com.brindix.orders;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Un cobro: paga una o varias rondas de la cuenta. Queda en el turno de caja abierto. */
@Entity
@Table(name = "payments")
@Getter
@Setter
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long tabId;
    private Long shiftId;
    private BigDecimal subtotal;
    private BigDecimal discount = BigDecimal.ZERO;
    private BigDecimal tip = BigDecimal.ZERO;
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    private PaymentMethod method;

    private String note;
    private Long collectedBy;
    private Instant collectedAt = Instant.now();
    /** false = lo cobró un mesero y todavía no lo entrega en caja. */
    private boolean settled;
    private Long settledBy;
    private Instant settledAt;
    private boolean voided;
    private String voidReason;
}
