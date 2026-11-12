package com.brindix.catalog;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

public final class CatalogDtos {

    private CatalogDtos() {}

    public record CategoryView(Long id, String name, String icon, String art, int sortOrder, boolean active, long products) {
        public static CategoryView of(Category c, long products) {
            return new CategoryView(c.getId(), c.getName(), c.getIcon(), c.getArt(), c.getSortOrder(), c.isActive(), products);
        }
    }

    public record CategoryInput(@NotBlank @Size(max = 80) String name, @Size(max = 16) String icon,
                                @Size(max = 30) String art, int sortOrder, boolean active) {}

    /** Producto tal como lo ve el cliente o el mesero en la carta (sin costo ni ganancia). */
    public record MenuProduct(Long id, Long categoryId, String name, String description, BigDecimal price,
                              String imageUrl, String art, boolean featured, boolean soldOut, List<String> tags,
                              boolean trackStock, Integer stock, String unit) {}

    public record MenuCategory(Long id, String name, String icon, String art, List<MenuProduct> products) {}

    /** Producto completo para el administrador: precio de venta, costo y ganancia. */
    public record ProductView(Long id, Long categoryId, String categoryName, String name, String description,
                              BigDecimal price, BigDecimal cost, BigDecimal profit, BigDecimal marginPct,
                              String imageUrl, String art, String unit, boolean trackStock, int stock, int minStock,
                              boolean available, boolean featured, String tags, int sortOrder, boolean soldOut, boolean lowStock) {}

    public record ProductInput(@NotNull Long categoryId,
                               @NotBlank @Size(max = 120) String name,
                               @Size(max = 600) String description,
                               @NotNull @DecimalMin("0") BigDecimal price,
                               @DecimalMin("0") BigDecimal cost,
                               @Size(max = 500) String imageUrl,
                               @Size(max = 20) String unit,
                               boolean trackStock,
                               @Min(0) int minStock,
                               boolean available,
                               boolean featured,
                               @Size(max = 200) String tags,
                               /** Solo al crear: existencias iniciales (se registran como ajuste). */
                               Integer initialStock) {}

    /** Edición rápida desde la lista (un campo a la vez). */
    public record ProductPatch(@DecimalMin("0") BigDecimal price, @DecimalMin("0") BigDecimal cost, @Size(max = 500) String imageUrl,
                               Boolean available, Boolean featured, Boolean clearImage) {}

    public record Reorder(@NotEmpty List<Long> ids) {}

    public record ProductReorder(@NotNull Long categoryId, @NotNull List<Long> ids) {}
}
