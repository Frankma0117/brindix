package com.brindix.bar;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class BarDtos {

    private BarDtos() {}

    public record RecipeLine(String ingredient, String unit, BigDecimal quantity) {}

    public record QueueItem(Long id, Long roundId, Long tabId, String tableName, Instant at, int quantity,
                            String productName, String note, List<RecipeLine> recipe) {}

    public record Queue(List<QueueItem> items) {}
}
