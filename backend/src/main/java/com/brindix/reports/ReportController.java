package com.brindix.reports;

import com.brindix.audit.AuditService;
import com.brindix.cash.CashDtos;
import com.brindix.cash.CashService;
import com.brindix.catalog.CatalogDtos;
import com.brindix.catalog.CatalogService;
import com.brindix.common.AppProperties;
import com.brindix.orders.OrderDtos;
import com.brindix.orders.PaymentService;
import com.brindix.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Reportes, caja y bitácora: todo solo para el administrador del bar. */
@RestController
public class ReportController {

    private final ReportService reports;
    private final CashService cash;
    private final PaymentService payments;
    private final CatalogService catalog;
    private final AuditService audit;
    private final AppProperties props;

    public ReportController(ReportService reports, CashService cash, PaymentService payments, CatalogService catalog,
                            AuditService audit, AppProperties props) {
        this.reports = reports;
        this.cash = cash;
        this.payments = payments;
        this.catalog = catalog;
        this.audit = audit;
        this.props = props;
    }

    @GetMapping("/api/admin/dashboard")
    public ReportService.Dashboard dashboard() {
        return reports.dashboard(CurrentUser.venueId());
    }

    @GetMapping("/api/admin/reports/summary")
    public ReportService.Summary summary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate today = LocalDateTime.now(props.zone()).minusHours(6).toLocalDate();
        LocalDate end = to == null ? today : to;
        LocalDate start = from == null ? end.minusDays(6) : from;
        if (start.isAfter(end)) start = end;
        return reports.summary(CurrentUser.venueId(), start, end);
    }

    @GetMapping("/api/admin/reports/low-stock")
    public List<CatalogDtos.ProductView> lowStock() {
        return catalog.listProducts(CurrentUser.venueId()).stream().filter(CatalogDtos.ProductView::lowStock).toList();
    }

    @GetMapping("/api/admin/audit")
    public List<AuditService.AuditView> audit(@RequestParam(required = false) String entity, @RequestParam(required = false) Long entityId,
                                              @RequestParam(required = false) Instant from, @RequestParam(defaultValue = "200") int limit) {
        return audit.list(CurrentUser.venueId(), entity, entityId, from, limit);
    }

    // ---------- Caja ----------

    /** Estado de la caja: turno abierto (si hay) y cobros de meseros por recibir. */
    @GetMapping("/api/admin/cash")
    public Map<String, Object> cashState() {
        Long venueId = CurrentUser.venueId();
        var current = cash.current(venueId);
        return Map.of("open", current.isPresent(),
                "shift", current.map(cash::status).map(Object.class::cast).orElse(Map.of()),
                "unsettled", payments.unsettled(CurrentUser.get()));
    }

    @PostMapping("/api/admin/cash/open")
    public CashDtos.ShiftStatus open(@Valid @RequestBody CashDtos.OpenInput in) {
        return cash.open(CurrentUser.get(), in);
    }

    @PostMapping("/api/admin/cash/movements")
    public CashDtos.ShiftStatus movement(@Valid @RequestBody CashDtos.MovementInput in) {
        return cash.addMovement(CurrentUser.get(), in);
    }

    @DeleteMapping("/api/admin/cash/movements/{id}")
    public CashDtos.ShiftStatus deleteMovement(@PathVariable Long id) {
        return cash.deleteMovement(CurrentUser.get(), id);
    }

    @PostMapping("/api/admin/cash/close")
    public ReportService.ShiftReport close(@Valid @RequestBody CashDtos.CloseInput in) {
        var s = cash.close(CurrentUser.get(), in);
        return reports.shift(CurrentUser.venueId(), s.getId());
    }

    @GetMapping("/api/admin/cash/shifts")
    public List<CashDtos.ShiftRow> shifts() {
        return cash.history(CurrentUser.venueId());
    }

    /** Reporte del turno (cierre de caja). Sin id = el turno abierto. */
    @GetMapping({"/api/admin/cash/report", "/api/admin/cash/report/{id}"})
    public ReportService.ShiftReport report(@PathVariable(required = false) Long id) {
        return reports.shift(CurrentUser.venueId(), id);
    }

    @GetMapping("/api/admin/cash/shifts/{id}/payments")
    public List<OrderDtos.PaymentView> shiftPayments(@PathVariable Long id) {
        return payments.ofShift(CurrentUser.get(), id);
    }
}
