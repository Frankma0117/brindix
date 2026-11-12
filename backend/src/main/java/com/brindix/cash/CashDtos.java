package com.brindix.cash;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class CashDtos {

    private CashDtos() {}

    public record OpenInput(@NotNull @DecimalMin("0") BigDecimal openingCash, @Size(max = 300) String note) {}

    public record MovementInput(@NotNull CashMovement.Direction direction, @NotNull CashMovement.Category category,
                                @Size(max = 20) String method, @NotNull @DecimalMin("1") BigDecimal amount,
                                @NotBlank @Size(max = 300) String description) {}

    public record CloseInput(@NotNull @DecimalMin("0") BigDecimal countedCash, @Size(max = 500) String note) {}

    public record MovementView(Long id, CashMovement.Direction direction, CashMovement.Category category, String method,
                               BigDecimal amount, String description, String createdByName, Instant createdAt) {}

    public record ShiftRow(Long id, String status, Instant openedAt, Instant closedAt, String openedByName, String closedByName,
                           BigDecimal openingCash, BigDecimal expectedCash, BigDecimal countedCash, BigDecimal difference,
                           BigDecimal sales) {}

    /** Estado del turno abierto, para el tablero de caja. */
    public record ShiftStatus(Long id, Instant openedAt, String openedByName, BigDecimal openingCash,
                              BigDecimal cashSales, BigDecimal cashIn, BigDecimal cashOut, BigDecimal expectedCash,
                              BigDecimal salesTotal, BigDecimal tips, int payments, int unsettledCount, BigDecimal unsettledTotal,
                              List<MovementView> movements) {}
}
