package com.brindix.orders;

import com.brindix.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class OrderController {

    private final OrderService orders;
    private final PaymentService payments;

    public OrderController(OrderService orders, PaymentService payments) {
        this.orders = orders;
        this.payments = payments;
    }

    // ---------- Mesero y administrador ----------

    @GetMapping("/api/staff/board")
    public OrderDtos.Board board() {
        return orders.board(CurrentUser.get());
    }

    @PostMapping("/api/staff/tables/{tableId}/open")
    public OrderDtos.TabView open(@PathVariable Long tableId, @Valid @RequestBody(required = false) OrderDtos.OpenInput in) {
        return orders.openTab(CurrentUser.get(), tableId, in);
    }

    @GetMapping("/api/staff/tabs/{id}")
    public OrderDtos.TabView tab(@PathVariable Long id) {
        return orders.tab(CurrentUser.get(), id);
    }

    @PostMapping("/api/staff/tabs/{id}/rounds")
    public OrderDtos.TabView addRound(@PathVariable Long id, @Valid @RequestBody OrderDtos.RoundInput in) {
        return orders.addRound(CurrentUser.get(), id, in);
    }

    @PostMapping("/api/staff/rounds/{id}/deliver")
    public OrderDtos.TabView deliver(@PathVariable Long id) {
        return orders.deliver(CurrentUser.get(), id);
    }

    @PostMapping("/api/staff/tabs/{id}/charge")
    public OrderDtos.TabView charge(@PathVariable Long id, @Valid @RequestBody OrderDtos.ChargeInput in) {
        return payments.charge(CurrentUser.get(), id, in);
    }

    @PostMapping("/api/staff/tabs/{id}/release")
    public OrderDtos.TabView release(@PathVariable Long id) {
        return orders.release(CurrentUser.get(), id);
    }

    @PostMapping("/api/staff/tabs/{id}/move")
    public OrderDtos.TabView move(@PathVariable Long id, @Valid @RequestBody OrderDtos.MoveInput in) {
        return orders.moveTab(CurrentUser.get(), id, in.tableId());
    }

    @PostMapping("/api/staff/calls/{id}/done")
    public void callDone(@PathVariable Long id) {
        orders.resolveCall(CurrentUser.get(), id);
    }

    // ---------- Solo administrador: modificar pedidos ----------

    @PostMapping("/api/admin/rounds/{id}/assign")
    public OrderDtos.TabView assign(@PathVariable Long id, @Valid @RequestBody OrderDtos.AssignInput in) {
        return orders.assign(CurrentUser.get(), id, in.waiterId());
    }

    @PostMapping("/api/admin/rounds/{id}/reject")
    public OrderDtos.TabView reject(@PathVariable Long id, @Valid @RequestBody(required = false) OrderDtos.ReasonInput in) {
        return orders.reject(CurrentUser.get(), id, in == null ? null : in.reason());
    }

    @PostMapping("/api/admin/items/{id}/quantity")
    public OrderDtos.TabView quantity(@PathVariable Long id, @Valid @RequestBody OrderDtos.QuantityInput in) {
        return orders.changeQuantity(CurrentUser.get(), id, in);
    }

    @PostMapping("/api/admin/items/{id}/void")
    public OrderDtos.TabView voidItem(@PathVariable Long id, @Valid @RequestBody OrderDtos.ReasonInput in) {
        return orders.voidItem(CurrentUser.get(), id, in.reason());
    }

    @PostMapping("/api/admin/tabs/{id}/waiter")
    public OrderDtos.TabView waiter(@PathVariable Long id, @Valid @RequestBody OrderDtos.AssignInput in) {
        return orders.setWaiter(CurrentUser.get(), id, in.waiterId());
    }

    @GetMapping("/api/admin/payments/unsettled")
    public List<OrderDtos.PaymentView> unsettled() {
        return payments.unsettled(CurrentUser.get());
    }

    @PostMapping("/api/admin/payments/{id}/settle")
    public void settle(@PathVariable Long id) {
        payments.settle(CurrentUser.get(), id);
    }

    @PostMapping("/api/admin/payments/{id}/void")
    public void voidPayment(@PathVariable Long id, @Valid @RequestBody OrderDtos.ReasonInput in) {
        payments.voidPayment(CurrentUser.get(), id, in.reason());
    }

    // ---------- Cliente (QR de la mesa) ----------

    @GetMapping("/api/public/{slug}/tables/{code}/tab")
    public OrderDtos.PublicTab clientTab(@PathVariable String slug, @PathVariable String code) {
        return orders.clientTab(slug, code);
    }

    @PostMapping("/api/public/{slug}/tables/{code}/orders")
    public OrderDtos.PublicTab clientOrder(@PathVariable String slug, @PathVariable String code,
                                           @Valid @RequestBody OrderDtos.ClientOrderInput in) {
        return orders.clientOrder(slug, code, in);
    }

    @PostMapping("/api/public/{slug}/tables/{code}/call")
    public OrderDtos.PublicTab call(@PathVariable String slug, @PathVariable String code,
                                    @RequestParam(defaultValue = "WAITER") CallType type) {
        return orders.clientCall(slug, code, type);
    }
}
