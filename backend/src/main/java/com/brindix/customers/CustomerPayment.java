package com.brindix.customers;

import com.brindix.orders.PaymentMethod;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Abono de un cliente a su deuda. Si fue en efectivo, entra al cajón del turno abierto. */
@Entity
@Table(name = "customer_payments")
@Getter
@Setter
public class CustomerPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long customerId;
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    private PaymentMethod method;

    private String note;
    private Long shiftId;
    private Long cashMovementId;
    private Long createdBy;
    private Instant createdAt = Instant.now();
    private boolean voided;
}
