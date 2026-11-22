package com.brindix.notifications;

import com.brindix.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class NotificationController {

    private final NotificationService notifications;
    private final SetupChecklistService checklist;

    public NotificationController(NotificationService notifications, SetupChecklistService checklist) {
        this.notifications = notifications;
        this.checklist = checklist;
    }

    @GetMapping("/api/admin/notifications")
    public NotificationService.Feed feed() {
        return notifications.feed(CurrentUser.venueId());
    }

    @PostMapping("/api/admin/notifications/{id}/read")
    public void read(@PathVariable Long id) {
        notifications.markRead(CurrentUser.venueId(), id);
    }

    @PostMapping("/api/admin/notifications/read-all")
    public void readAll() {
        notifications.markAllRead(CurrentUser.venueId());
    }

    @GetMapping("/api/admin/setup-checklist")
    public List<SetupChecklistService.Item> setup() {
        return checklist.checklist(CurrentUser.venueId());
    }
}
