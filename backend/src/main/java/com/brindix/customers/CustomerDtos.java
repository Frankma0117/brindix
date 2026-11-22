package com.brindix.customers;

import com.brindix.orders.PaymentMethod;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class CustomerDtos {

    private CustomerDtos() {}

    public record CustomerInput(@NotBlank @Size(max = 120) String name, @Size(max = 40) String phone, @Size(max = 300) String note, Boolean preferred) {}

    public record QuickInput(@NotBlank @Size(max = 120) String name, @Size(max = 40) String phone) {}

    public record PaymentInput(@NotNull @DecimalMin("1") BigDecimal amount, @NotNull PaymentMethod method, @Size(max = 300) String note) {}

    public record Row(Long id, String name, String phone, String note, BigDecimal balance, Instant lastMovementAt, boolean preferred) {}

    public record Option(Long id, String name, String phone, BigDecimal balance, boolean preferred) {}

    /** kind: CREDIT = fiado (suma deuda), PAYMENT = abono (la baja). */
    public record Entry(String kind, Long id, BigDecimal amount, PaymentMethod method, String note, String byName,
                        Instant at, boolean voided, String detail) {}

    public record Detail(Row customer, List<Entry> entries) {}

    public record Overview(BigDecimal totalOwed, int debtors, List<Row> customers) {}
}
