package com.brindix.cash;

import com.brindix.audit.AuditService;
import com.brindix.common.ApiException;
import com.brindix.orders.Payment;
import com.brindix.orders.PaymentMethod;
import com.brindix.orders.PaymentRepository;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.StaffUser;
import com.brindix.staff.StaffUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Caja del bar (solo administrador). El efectivo esperado en el cajón es:
 * base + cobros en efectivo ya entregados en caja + entradas en efectivo − salidas en efectivo.
 * Lo que cobró un mesero y aún no entrega queda aparte ("en poder de meseros").
 */
@Service
public class CashService {

    private final CashShiftRepository shifts;
    private final CashMovementRepository movements;
    private final PaymentRepository payments;
    private final StaffUserRepository users;
    private final AuditService audit;

    public CashService(CashShiftRepository shifts, CashMovementRepository movements, PaymentRepository payments,
                       StaffUserRepository users, AuditService audit) {
        this.shifts = shifts;
        this.movements = movements;
        this.payments = payments;
        this.users = users;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Optional<CashShift> current(Long venueId) {
        return shifts.findFirstByVenueIdAndStatus(venueId, CashShift.Status.OPEN);
    }

    public CashShift requireOpen(Long venueId) {
        return current(venueId).orElseThrow(() ->
                ApiException.conflict("La caja está cerrada. El administrador debe abrir el turno antes de cobrar."));
    }

    @Transactional
    public CashDtos.ShiftStatus open(StaffPrincipal me, CashDtos.OpenInput in) {
        if (current(me.venueId()).isPresent()) throw ApiException.conflict("Ya hay un turno de caja abierto");
        CashShift s = new CashShift();
        s.setVenueId(me.venueId());
        s.setOpenedBy(me.id());
        s.setOpeningCash(in.openingCash());
        s.setOpeningNote(blank(in.note()));
        s = shifts.save(s);
        audit.log(me, me.venueId(), "Abrió caja", "cash", s.getId(), "Base " + in.openingCash());
        return status(s);
    }

    @Transactional
    public CashDtos.ShiftStatus addMovement(StaffPrincipal me, CashDtos.MovementInput in) {
        CashShift s = requireOpen(me.venueId());
        record(me, s, in.direction(), in.category(), in.method(), in.amount(), in.description());
        return status(s);
    }

    /** También lo usa inventario cuando una entrada de mercancía se paga de la caja. */
    @Transactional
    public CashMovement record(StaffPrincipal me, CashShift s, CashMovement.Direction dir, CashMovement.Category cat,
                               String method, BigDecimal amount, String description) {
        CashMovement m = new CashMovement();
        m.setVenueId(s.getVenueId());
        m.setShiftId(s.getId());
        m.setDirection(dir);
        m.setCategory(cat);
        m.setMethod(method == null || method.isBlank() ? "CASH" : method.trim().toUpperCase());
        m.setAmount(amount);
        m.setDescription(description.trim());
        m.setCreatedBy(me.id());
        m = movements.save(m);
        audit.log(me, s.getVenueId(), dir == CashMovement.Direction.IN ? "Entrada de caja" : "Salida de caja", "cash", s.getId(),
                cat + " · " + amount + " · " + m.getMethod() + " · " + description);
        return m;
    }

    @Transactional
    public CashDtos.ShiftStatus deleteMovement(StaffPrincipal me, Long id) {
        CashShift s = requireOpen(me.venueId());
        CashMovement m = movements.findById(id).filter(x -> x.getShiftId().equals(s.getId()))
                .orElseThrow(() -> ApiException.notFound("Solo se pueden borrar movimientos del turno abierto"));
        movements.delete(m);
        audit.log(me, me.venueId(), "Borró movimiento de caja", "cash", s.getId(),
                m.getDirection() + " " + m.getCategory() + " · " + m.getAmount() + " · " + m.getDescription());
        return status(s);
    }

    @Transactional
    public CashShift close(StaffPrincipal me, CashDtos.CloseInput in) {
        CashShift s = requireOpen(me.venueId());
        List<Payment> pending = payments.findByVenueIdAndSettledFalseAndVoidedFalseOrderByCollectedAtAsc(me.venueId());
        if (!pending.isEmpty()) {
            BigDecimal sum = pending.stream().map(Payment::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            throw ApiException.conflict("Hay " + pending.size() + " cobro(s) de meseros sin entregar en caja (" + sum
                    + "). Recíbelos antes de cerrar.");
        }
        CashDtos.ShiftStatus st = status(s);
        s.setExpectedCash(st.expectedCash());
        s.setCountedCash(in.countedCash());
        s.setDifference(in.countedCash().subtract(st.expectedCash()));
        s.setClosingNote(blank(in.note()));
        s.setClosedBy(me.id());
        s.setClosedAt(Instant.now());
        s.setStatus(CashShift.Status.CLOSED);
        audit.log(me, me.venueId(), "Cerró caja", "cash", s.getId(),
                "Esperado " + st.expectedCash() + " · contado " + in.countedCash() + " · diferencia " + s.getDifference());
        return s;
    }

    @Transactional(readOnly = true)
    public CashShift owned(Long venueId, Long id) {
        return shifts.findById(id).filter(s -> s.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Turno no encontrado"));
    }

    @Transactional(readOnly = true)
    public CashDtos.ShiftStatus status(CashShift s) {
        List<Payment> ps = payments.findByShiftIdOrderByCollectedAtAsc(s.getId()).stream().filter(p -> !p.isVoided()).toList();
        List<CashMovement> ms = movements.findByShiftIdOrderByCreatedAtAsc(s.getId());
        BigDecimal cashSales = sum(ps.stream().filter(p -> p.getMethod() == PaymentMethod.CASH && p.isSettled()).map(Payment::getTotal).toList());
        BigDecimal cashIn = sum(ms.stream().filter(m -> m.cash() && m.getDirection() == CashMovement.Direction.IN).map(CashMovement::getAmount).toList());
        BigDecimal cashOut = sum(ms.stream().filter(m -> m.cash() && m.getDirection() == CashMovement.Direction.OUT).map(CashMovement::getAmount).toList());
        List<Payment> unsettled = ps.stream().filter(p -> !p.isSettled()).toList();
        Map<Long, String> names = names(ms.stream().map(CashMovement::getCreatedBy).collect(Collectors.toSet()), s.getOpenedBy());
        return new CashDtos.ShiftStatus(s.getId(), s.getOpenedAt(), names.get(s.getOpenedBy()), s.getOpeningCash(),
                cashSales, cashIn, cashOut, s.getOpeningCash().add(cashSales).add(cashIn).subtract(cashOut),
                sum(ps.stream().map(Payment::getTotal).toList()), sum(ps.stream().map(Payment::getTip).toList()), ps.size(),
                unsettled.size(), sum(unsettled.stream().map(Payment::getTotal).toList()),
                ms.stream().map(m -> new CashDtos.MovementView(m.getId(), m.getDirection(), m.getCategory(), m.getMethod(),
                        m.getAmount(), m.getDescription(), names.get(m.getCreatedBy()), m.getCreatedAt())).toList());
    }

    @Transactional(readOnly = true)
    public List<CashDtos.ShiftRow> history(Long venueId) {
        List<CashShift> list = shifts.findTop60ByVenueIdOrderByOpenedAtDesc(venueId);
        Set<Long> ids = new HashSet<>();
        list.forEach(s -> {
            ids.add(s.getOpenedBy());
            if (s.getClosedBy() != null) ids.add(s.getClosedBy());
        });
        Map<Long, String> names = names(ids, null);
        return list.stream().map(s -> new CashDtos.ShiftRow(s.getId(), s.getStatus().name(), s.getOpenedAt(), s.getClosedAt(),
                names.get(s.getOpenedBy()), names.get(s.getClosedBy()), s.getOpeningCash(), s.getExpectedCash(), s.getCountedCash(),
                s.getDifference(), sum(payments.findByShiftIdOrderByCollectedAtAsc(s.getId()).stream().filter(p -> !p.isVoided())
                .map(Payment::getTotal).toList()))).toList();
    }

    private Map<Long, String> names(Set<Long> ids, Long extra) {
        Set<Long> all = new HashSet<>(ids);
        if (extra != null) all.add(extra);
        all.remove(null);
        return users.findAllById(all).stream().collect(Collectors.toMap(StaffUser::getId, StaffUser::getName));
    }

    static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
