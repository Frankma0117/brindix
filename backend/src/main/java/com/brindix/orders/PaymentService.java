package com.brindix.orders;

import com.brindix.audit.AuditService;
import com.brindix.cash.CashService;
import com.brindix.cash.CashShift;
import com.brindix.common.ApiException;
import com.brindix.security.StaffPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Cobros. Se puede cobrar ronda por ronda o todo junto. Si cobra un mesero, el dinero queda
 * "en poder del mesero" hasta que el administrador lo recibe en caja. Todo cobro cae en el turno abierto.
 */
@Service
public class PaymentService {

    private final OrderService orders;
    private final RoundRepository rounds;
    private final PaymentRepository payments;
    private final CashService cash;
    private final AuditService audit;

    public PaymentService(OrderService orders, RoundRepository rounds, PaymentRepository payments, CashService cash, AuditService audit) {
        this.orders = orders;
        this.rounds = rounds;
        this.payments = payments;
        this.cash = cash;
        this.audit = audit;
    }

    @Transactional
    public OrderDtos.TabView charge(StaffPrincipal me, Long tabId, OrderDtos.ChargeInput in) {
        if (!orders.canCharge(me)) throw ApiException.forbidden("En este bar solo el administrador cobra");
        Tab tab = orders.openTabOrFail(me.venueId(), tabId);
        CashShift shift = cash.requireOpen(me.venueId());
        List<Round> all = rounds.findByTabIdOrderByCreatedAtAsc(tab.getId());
        List<Round> selected;
        if (in.roundIds() == null || in.roundIds().isEmpty()) {
            selected = all.stream().filter(Round::payable).toList();
        } else {
            Set<Long> ids = new HashSet<>(in.roundIds());
            selected = all.stream().filter(r -> ids.contains(r.getId())).toList();
            if (selected.size() != ids.size()) throw ApiException.badRequest("Alguna ronda no es de esta cuenta");
            for (Round r : selected) {
                if (!r.payable()) throw ApiException.conflict("La ronda #" + r.getId() + " ya está pagada o no se puede cobrar");
            }
        }
        if (selected.isEmpty()) throw ApiException.conflict("No hay nada pendiente por cobrar");

        BigDecimal subtotal = selected.stream().map(Round::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = in.discount() == null ? BigDecimal.ZERO : in.discount();
        BigDecimal tip = in.tip() == null ? BigDecimal.ZERO : in.tip();
        if (discount.compareTo(subtotal) > 0) throw ApiException.badRequest("El descuento no puede ser mayor que lo que se cobra");
        if (discount.signum() > 0 && !me.isAdmin()) throw ApiException.forbidden("Solo el administrador puede dar descuentos");

        Payment p = new Payment();
        p.setVenueId(me.venueId());
        p.setTabId(tab.getId());
        p.setShiftId(shift.getId());
        p.setSubtotal(subtotal);
        p.setDiscount(discount);
        p.setTip(tip);
        p.setTotal(subtotal.subtract(discount).add(tip));
        p.setMethod(in.method());
        p.setNote(in.note() == null || in.note().isBlank() ? null : in.note().trim());
        p.setCollectedBy(me.id());
        p.setSettled(me.isAdmin());
        if (me.isAdmin()) {
            p.setSettledBy(me.id());
            p.setSettledAt(Instant.now());
        }
        p = payments.save(p);
        for (Round r : selected) {
            r.setPaymentId(p.getId());
            if (r.getStatus() == RoundStatus.CONFIRMED) {
                r.setStatus(RoundStatus.DELIVERED);
                r.setDeliveredAt(Instant.now());
            }
        }
        audit.log(me, me.venueId(), "Cobró", "payment", p.getId(), "Mesa " + orders.tableName(tab) + " · " + selected.size()
                + " ronda(s) · " + p.getTotal() + " · " + p.getMethod() + (p.isSettled() ? "" : " · pendiente de entregar en caja"));
        if (in.release() && OrderService.due(all).signum() == 0) {
            return orders.release(me, tab.getId());
        }
        return orders.tabView(me, tab);
    }

    /** El administrador recibe en caja lo que cobró un mesero. */
    @Transactional
    public void settle(StaffPrincipal me, Long paymentId) {
        Payment p = owned(me, paymentId);
        if (p.isVoided()) throw ApiException.conflict("Ese cobro está anulado");
        if (p.isSettled()) return;
        p.setSettled(true);
        p.setSettledBy(me.id());
        p.setSettledAt(Instant.now());
        audit.log(me, me.venueId(), "Recibió dinero de mesero", "payment", p.getId(), p.getTotal() + " · " + p.getMethod());
    }

    /** Anular un cobro del turno abierto: las rondas vuelven a quedar por cobrar. */
    @Transactional
    public void voidPayment(StaffPrincipal me, Long paymentId, String reason) {
        if (reason == null || reason.isBlank()) throw ApiException.badRequest("Escribe el motivo");
        Payment p = owned(me, paymentId);
        CashShift shift = cash.requireOpen(me.venueId());
        if (!p.getShiftId().equals(shift.getId())) throw ApiException.conflict("Solo se anulan cobros del turno abierto");
        if (p.isVoided()) return;
        Tab tab = orders.ownedTab(me.venueId(), p.getTabId());
        if (tab.getStatus() != TabStatus.OPEN) throw ApiException.conflict("La mesa ya se liberó: no se puede anular este cobro");
        p.setVoided(true);
        p.setVoidReason(reason.trim());
        for (Round r : rounds.findByPaymentIdIn(List.of(p.getId()))) r.setPaymentId(null);
        audit.log(me, me.venueId(), "Anuló cobro", "payment", p.getId(), p.getTotal() + " · " + p.getMethod() + " · " + reason);
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentView> unsettled(StaffPrincipal me) {
        Map<Long, String> names = orders.staffNames(me.venueId());
        return payments.findByVenueIdAndSettledFalseAndVoidedFalseOrderByCollectedAtAsc(me.venueId()).stream()
                .map(p -> orders.paymentView(p, orders.tableName(orders.ownedTab(me.venueId(), p.getTabId())), names)).toList();
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.PaymentView> ofShift(StaffPrincipal me, Long shiftId) {
        Map<Long, String> names = orders.staffNames(me.venueId());
        return payments.findByShiftIdOrderByCollectedAtAsc(cash.owned(me.venueId(), shiftId).getId()).stream()
                .map(p -> orders.paymentView(p, orders.tableName(orders.ownedTab(me.venueId(), p.getTabId())), names)).toList();
    }

    private Payment owned(StaffPrincipal me, Long id) {
        return payments.findById(id).filter(p -> p.getVenueId().equals(me.venueId()))
                .orElseThrow(() -> ApiException.notFound("Cobro no encontrado"));
    }
}
