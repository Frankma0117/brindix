package com.brindix.inventory;

import com.brindix.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/inventory")
public class InventoryController {

    private final InventoryService service;

    public InventoryController(InventoryService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public InventoryDtos.StockSummary summary() {
        return service.summary(CurrentUser.venueId());
    }

    @GetMapping("/movements")
    public List<InventoryDtos.MovementView> movements(@RequestParam(required = false) Long productId,
                                                      @RequestParam(required = false) MovementType type,
                                                      @RequestParam(required = false) Instant from,
                                                      @RequestParam(required = false) Instant to,
                                                      @RequestParam(defaultValue = "300") int limit) {
        return service.list(CurrentUser.venueId(), productId, type, from, to, limit);
    }

    @PostMapping("/entries")
    public Map<String, Integer> entry(@Valid @RequestBody InventoryDtos.EntryRequest in) {
        return Map.of("items", service.registerEntry(CurrentUser.get(), in));
    }

    @PostMapping("/adjustments")
    public void adjust(@Valid @RequestBody InventoryDtos.AdjustRequest in) {
        service.adjust(CurrentUser.get(), in);
    }
}
