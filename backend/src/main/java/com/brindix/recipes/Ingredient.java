package com.brindix.recipes;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Insumo que se gasta al vender productos con receta (ron en shots, jugo en ml, limones en und...). */
@Entity
@Table(name = "ingredients")
@Getter
@Setter
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String name;
    private String unit;
    private BigDecimal stock = BigDecimal.ZERO;
    private BigDecimal minStock;
    /** Costo promedio ponderado por unidad. */
    private BigDecimal avgCost = BigDecimal.ZERO;
    private boolean archived;
    private Instant createdAt = Instant.now();

    public boolean lowStock() {
        return minStock != null && stock.compareTo(minStock) <= 0;
    }
}
