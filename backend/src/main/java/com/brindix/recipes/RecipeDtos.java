package com.brindix.recipes;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class RecipeDtos {

    private RecipeDtos() {}

    public record IngredientInput(@NotBlank @Size(max = 120) String name, @NotBlank @Size(max = 10) String unit,
                                  @DecimalMin("0") BigDecimal minStock) {}

    public record IngredientView(Long id, String name, String unit, BigDecimal stock, BigDecimal minStock,
                                 BigDecimal avgCost, boolean low) {}

    /**
     * ENTRY: quantity = lo que entra; costo con unitCost o totalCost (uno de los dos, opcional).
     * ADJUST: quantity = lo que se contó (queda el stock en ese valor). WASTE: quantity = lo perdido.
     */
    public record MovementInput(@NotNull IngredientMovementType type, @NotNull @DecimalMin("0") BigDecimal quantity,
                                @DecimalMin("0") BigDecimal unitCost, @DecimalMin("0") BigDecimal totalCost,
                                @Size(max = 300) String note) {}

    public record MovementView(Long id, IngredientMovementType type, BigDecimal quantity, BigDecimal stockAfter,
                               BigDecimal unitCost, String note, Instant createdAt) {}

    public record LineInput(@NotNull Long ingredientId, @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity) {}

    public record RecipeInput(@NotNull @Valid List<LineInput> lines) {}

    public record LineView(Long ingredientId, String name, String unit, BigDecimal quantity, BigDecimal unitCost,
                           BigDecimal lineCost) {}

    /** margin = precio - costo de la receta; marginPct sobre el precio (null si el precio es 0). */
    public record RecipeView(Long productId, BigDecimal price, List<LineView> lines, BigDecimal cost, BigDecimal margin,
                             BigDecimal marginPct) {}
}
