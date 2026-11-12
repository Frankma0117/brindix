package com.brindix.catalog;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "products")
@Getter
@Setter
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long categoryId;
    private String name;
    private String description;
    private BigDecimal price;
    /** Costo de compra por unidad (para margen). Se actualiza con cada entrada de mercancia. */
    private BigDecimal cost;
    private String imageUrl;
    private String unit = "und";
    /** false para cosas que no se cuentan (cocteles preparados, picadas). */
    private boolean trackStock = true;
    private int stock;
    private int minStock;
    private boolean available = true;
    private boolean featured;
    private String tags;
    private int sortOrder;
    /** Archivado = ya no se vende pero se conserva para el historial. */
    private boolean archived;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    /** Agotado para el cliente: solo si se lleva inventario y no queda. */
    public boolean soldOut() {
        return trackStock && stock <= 0;
    }

    public boolean lowStock() {
        return trackStock && stock <= minStock;
    }
}
