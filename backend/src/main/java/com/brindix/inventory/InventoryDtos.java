package com.brindix.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class InventoryDtos {

    private InventoryDtos() {}

    public record EntryItem(@NotNull Long productId, @Min(1) @Max(100000) int quantity, @DecimalMin("0") BigDecimal unitCost) {}

    /** Una factura o pedido del proveedor con varios productos. paidFromCash = sale dinero de la caja abierta. */
    public record EntryRequest(@Size(max = 120) String supplier, @Size(max = 120) String reference,
                               @Size(max = 300) String note, boolean paidFromCash, @Size(max = 20) String paymentMethod,
                               @NotEmpty @Valid List<EntryItem> items) {}

    /** ADJUSTMENT: countedStock = lo que se contó. WASTE: quantity = unidades perdidas. */
    public record AdjustRequest(@NotNull Long productId, @NotNull MovementType type, Integer countedStock,
                                Integer quantity, @Size(max = 300) String note) {}

    public record MovementView(Long id, Long productId, String productName, MovementType type, int quantity,
                               int stockAfter, BigDecimal unitCost, String supplier, String reference, String note,
                               String userName, Long tabId, Instant createdAt) {}

    public record StockSummary(int products, int lowStock, int soldOut, BigDecimal inventoryValue, BigDecimal saleValue) {}
}
