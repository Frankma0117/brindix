package com.brindix.cash;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Entrada o salida de dinero que no es una venta: recibos pagados, reposiciones, retiros... */
@Entity
@Table(name = "cash_movements")
@Getter
@Setter
public class CashMovement {

    public enum Direction { IN, OUT }

    /** BILL = pago de recibo/servicio. RESTOCK = compra o reposición de mercancía. */
    public enum Category { BILL, RESTOCK, WITHDRAWAL, DEPOSIT, TIP_PAYOUT, SALARY, OTHER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long shiftId;

    @Enumerated(EnumType.STRING)
    private Direction direction;

    @Enumerated(EnumType.STRING)
    private Category category;

    /** CASH sale del cajón; los demás (transferencia, Nequi...) no afectan el efectivo contado. */
    private String method = "CASH";
    private BigDecimal amount;
    private String description;
    private Long createdBy;
    private Instant createdAt = Instant.now();

    public boolean cash() {
        return "CASH".equals(method);
    }
}
