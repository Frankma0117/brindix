package com.brindix.recipes;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "recipe_lines")
@Getter
@Setter
public class RecipeLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long productId;
    private Long ingredientId;
    /** Cantidad de insumo (en su unidad) que gasta UNA unidad vendida del producto. */
    private BigDecimal quantity;
}
