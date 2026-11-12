package com.brindix.tables;

import com.brindix.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tables")
public class TableController {

    private final TableService service;

    public TableController(TableService service) {
        this.service = service;
    }

    @GetMapping
    public List<TableService.TableView> list() {
        return service.list(CurrentUser.venueId()).stream().map(TableService.TableView::of).toList();
    }

    @PostMapping
    public TableService.TableView create(@RequestBody TableService.TableInput in) {
        return TableService.TableView.of(service.save(CurrentUser.venueId(), null, in));
    }

    @PutMapping("/{id}")
    public TableService.TableView update(@PathVariable Long id, @RequestBody TableService.TableInput in) {
        return TableService.TableView.of(service.save(CurrentUser.venueId(), id, in));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(CurrentUser.get(), id);
    }

    @PostMapping("/{id}/regenerate-code")
    public TableService.TableView regenerate(@PathVariable Long id) {
        return TableService.TableView.of(service.regenerateCode(CurrentUser.venueId(), id));
    }
}
