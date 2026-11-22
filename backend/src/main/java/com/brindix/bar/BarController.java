package com.brindix.bar;

import com.brindix.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

@RestController
public class BarController {

    private final BarService bar;

    public BarController(BarService bar) {
        this.bar = bar;
    }

    @GetMapping("/api/staff/bar/queue")
    public BarDtos.Queue queue() {
        return bar.queue(CurrentUser.venueId());
    }

    @PostMapping("/api/staff/bar/items/{id}/ready")
    public void ready(@PathVariable Long id) {
        bar.markReady(CurrentUser.get(), id);
    }

    @PostMapping("/api/staff/bar/items/{id}/undo")
    public void undo(@PathVariable Long id) {
        bar.undo(CurrentUser.get(), id);
    }
}
