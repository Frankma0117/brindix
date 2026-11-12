package com.brindix.inventory;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "stock_movements")
@Getter
@Setter
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long productId;

    @Enumerated(EnumType.STRING)
    private MovementType type;

    private int quantity;
    private int stockAfter;
    private BigDecimal unitCost;
    private String supplier;
    private String reference;
    private String note;
    private Long userId;
    private Long tabId;
    private Instant createdAt = Instant.now();
}
