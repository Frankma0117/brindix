package com.brindix.orders;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {}

    public record ItemInput(@NotNull Long productId, @Min(1) @Max(99) int quantity, @Size(max = 200) String note) {}

    /** Ronda cargada por el personal. assignedTo: el administrador puede elegir qué mesero la lleva. */
    public record RoundInput(@NotEmpty @Size(max = 40) @Valid List<ItemInput> items, @Size(max = 300) String note, Long assignedTo) {}

    public record ClientOrderInput(@NotEmpty @Size(max = 15) @Valid List<ItemInput> items,
                                   @Size(max = 80) String clientName, @Size(max = 300) String note) {}

    public record OpenInput(@Size(max = 120) String customerName, @Size(max = 500) String notes, Long waiterId) {}

    /** roundIds vacío = cobrar todo lo pendiente de pago. release = liberar la mesa si queda todo pago. */
    public record ChargeInput(List<Long> roundIds, @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal tip,
                              @NotNull PaymentMethod method, @Size(max = 300) String note, boolean release) {}

    public record ReasonInput(@Size(max = 200) String reason) {}

    public record AssignInput(@NotNull Long waiterId) {}

    public record QuantityInput(@Min(1) @Max(99) int quantity, @NotBlank @Size(max = 200) String reason) {}

    public record MoveInput(@NotNull Long tableId) {}

    public record ItemView(Long id, Long productId, String productName, BigDecimal unitPrice, int quantity,
                           String note, boolean voided, String voidReason, BigDecimal lineTotal) {
        static ItemView of(RoundItem i) {
            return new ItemView(i.getId(), i.getProductId(), i.getProductName(), i.getUnitPrice(), i.getQuantity(),
                    i.getNote(), i.isVoided(), i.getVoidReason(), i.lineTotal());
        }
    }

    public record RoundView(Long id, Long tabId, String tableName, RoundSource source, RoundStatus status,
                            String clientName, String note, String rejectReason, String createdByName,
                            Long assignedTo, String assignedToName, Instant createdAt, Instant confirmedAt, Instant deliveredAt,
                            BigDecimal total, boolean paid, Long paymentId, List<ItemView> items) {}

    public record PaymentView(Long id, Long tabId, String tableName, BigDecimal subtotal, BigDecimal discount, BigDecimal tip,
                              BigDecimal total, PaymentMethod method, String note, String collectedByName, Instant collectedAt,
                              boolean settled, String settledByName, boolean voided, String voidReason) {}

    /** consumed = todo lo confirmado; paid = lo ya cobrado; due = lo que falta cobrar. */
    public record TabView(Long id, Long tableId, String tableName, TabStatus status, String customerName, String notes,
                          Long waiterId, String waiterName, String openedByName, String closedByName, Instant openedAt, Instant closedAt,
                          BigDecimal consumed, BigDecimal paid, BigDecimal due, BigDecimal pendingTotal, int itemCount,
                          boolean canCharge, List<RoundView> rounds, List<PaymentView> payments) {}

    public record TableBoard(Long tableId, String name, String zone, int seats, String code, Long tabId,
                             String customerName, String waiterName, Instant openedAt, BigDecimal consumed, BigDecimal due,
                             int itemCount, int pendingRounds, int inProgress, List<CallType> calls) {}

    public record CallView(Long id, Long tableId, String tableName, CallType type, Instant createdAt) {}

    /** pending = pedidos de clientes por asignar; inProgress = rondas por entregar (el mesero ve las suyas). */
    public record Board(List<TableBoard> tables, List<RoundView> pending, List<RoundView> inProgress, List<CallView> calls,
                        boolean cashOpen, boolean canCharge) {}

    public record PublicTab(String tableName, boolean open, BigDecimal consumed, BigDecimal due, BigDecimal pendingTotal,
                            List<PublicRound> rounds, List<CallType> calls) {}

    public record PublicRound(Long id, RoundStatus status, RoundSource source, Instant createdAt, String rejectReason,
                              BigDecimal total, boolean paid, List<ItemView> items) {}
}
