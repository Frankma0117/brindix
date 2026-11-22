package com.brindix.recipes;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "ingredient_movements")
@Getter
@Setter
public class IngredientMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long ingredientId;

    @Enumerated(EnumType.STRING)
    private IngredientMovementType type;

    private BigDecimal quantity;
    private BigDecimal stockAfter;
    private BigDecimal unitCost;
    private String note;
    private Long tabId;
    private Long userId;
    private Instant createdAt = Instant.now();
}
