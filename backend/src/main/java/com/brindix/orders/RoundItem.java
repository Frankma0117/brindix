package com.brindix.orders;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "round_items")
@Getter
@Setter
public class RoundItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "round_id")
    private Round round;

    private Long productId;
    /** Nombre, precio y costo congelados al momento del pedido: cambiar la carta no altera cuentas ni ganancias. */
    private String productName;
    private BigDecimal unitPrice;
    private BigDecimal unitCost;
    private int quantity;
    private String note;
    private boolean voided;
    private String voidReason;

    public BigDecimal lineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    public BigDecimal lineCost() {
        return unitCost == null ? BigDecimal.ZERO : unitCost.multiply(BigDecimal.valueOf(quantity));
    }
}
