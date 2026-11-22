package com.brindix.customers;

import com.brindix.audit.AuditService;
import com.brindix.cash.CashMovement;
import com.brindix.cash.CashService;
import com.brindix.cash.CashShift;
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
 * Fiado. Saldo = cobros CREDIT no anulados menos abonos no anulados. Un abono en efectivo entra a la caja del turno
 * abierto (cuenta en el efectivo esperado); los otros métodos solo se registran.
 */
@Service
public class CustomerService {

    private final CustomerRepository customers;
    private final CustomerPaymentRepository abonos;
    private final PaymentRepository payments;
    private final CashService cash;
    private final StaffUserRepository users;
    private final AuditService audit;

    public CustomerService(CustomerRepository customers, CustomerPaymentRepository abonos, PaymentRepository payments,
                           CashService cash, StaffUserRepository users, AuditService audit) {
        this.customers = customers;
        this.abonos = abonos;
        this.payments = payments;
        this.cash = cash;
        this.users = users;
        this.audit = audit;
    }

    // ---------- Consultas ----------

    @Transactional(readOnly = true)
    public CustomerDtos.Overview overview(Long venueId, boolean debtorsOnly) {
        List<CustomerDtos.Row> rows = rows(venueId);
        BigDecimal total = rows.stream().map(CustomerDtos.Row::balance).filter(b -> b.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int debtors = (int) rows.stream().filter(r -> r.balance().signum() > 0).count();
        if (debtorsOnly) rows = rows.stream().filter(r -> r.balance().signum() > 0).toList();
        return new CustomerDtos.Overview(total, debtors, rows);
    }

    @Transactional(readOnly = true)
    public List<CustomerDtos.Option> options(Long venueId) {
        return rows(venueId).stream().map(r -> new CustomerDtos.Option(r.id(), r.name(), r.phone(), r.balance())).toList();
    }

    @Transactional(readOnly = true)
    public CustomerDtos.Detail detail(Long venueId, Long id) {
        Customer c = owned(venueId, id);
        Map<Long, String> names = users.findByVenueIdOrderByNameAsc(venueId).stream()
                .collect(Collectors.toMap(StaffUser::getId, StaffUser::getName));
        List<CustomerDtos.Entry> entries = new ArrayList<>();
        for (Payment p : payments.findByCustomerIdOrderByCollectedAtDesc(c.getId())) {
            entries.add(new CustomerDtos.Entry("CREDIT", p.getId(), p.getTotal(), p.getMethod(), p.getNote(),
                    names.get(p.getCollectedBy()), p.getCollectedAt(), p.isVoided(), "Cuenta #" + p.getTabId()));
        }
        for (CustomerPayment a : abonos.findByCustomerIdOrderByCreatedAtDesc(c.getId())) {
            entries.add(new CustomerDtos.Entry("PAYMENT", a.getId(), a.getAmount(), a.getMethod(), a.getNote(),
                    names.get(a.getCreatedBy()), a.getCreatedAt(), a.isVoided(), "Abono"));
        }
        entries.sort(Comparator.comparing(CustomerDtos.Entry::at).reversed());
        Instant last = entries.stream().filter(e -> !e.voided()).map(CustomerDtos.Entry::at).findFirst().orElse(null);
        return new CustomerDtos.Detail(row(c, balance(c.getId()), last), entries);
    }

    /** Saldo actual de un cliente: fiados no anulados menos abonos no anulados. */
    @Transactional(readOnly = true)
    public BigDecimal balance(Long customerId) {
        BigDecimal credit = payments.findByCustomerIdOrderByCollectedAtDesc(customerId).stream()
                .filter(p -> !p.isVoided() && p.getMethod() == PaymentMethod.CREDIT)
                .map(Payment::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paid = abonos.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .filter(a -> !a.isVoided()).map(CustomerPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return credit.subtract(paid);
    }

    // ---------- Clientes ----------

    @Transactional
    public CustomerDtos.Row create(StaffPrincipal me, CustomerDtos.CustomerInput in) {
        String name = in.name().trim();
        ensureUniqueName(me.venueId(), name, null);
        Customer c = new Customer();
        c.setVenueId(me.venueId());
        c.setName(name);
        c.setPhone(blank(in.phone()));
        c.setNote(blank(in.note()));
        c = customers.save(c);
        audit.log(me, me.venueId(), "Creó cliente de fiado", "customer", c.getId(), c.getName());
        return row(c, BigDecimal.ZERO, null);
    }

    @Transactional
    public CustomerDtos.Row update(StaffPrincipal me, Long id, CustomerDtos.CustomerInput in) {
        Customer c = owned(me.venueId(), id);
        String name = in.name().trim();
        ensureUniqueName(me.venueId(), name, c.getId());
        c.setName(name);
        c.setPhone(blank(in.phone()));
        c.setNote(blank(in.note()));
        audit.log(me, me.venueId(), "Editó cliente de fiado", "customer", c.getId(), c.getName());
        return row(c, balance(c.getId()), null);
    }

    @Transactional
    public void archive(StaffPrincipal me, Long id) {
        Customer c = owned(me.venueId(), id);
        if (balance(c.getId()).signum() != 0) throw ApiException.conflict("El cliente tiene saldo pendiente: no se puede eliminar");
        c.setArchived(true);
        audit.log(me, me.venueId(), "Archivó cliente de fiado", "customer", c.getId(), c.getName());
    }

    // ---------- Abonos ----------

    @Transactional
    public CustomerDtos.Detail addPayment(StaffPrincipal me, Long customerId, CustomerDtos.PaymentInput in) {
        Customer c = owned(me.venueId(), customerId);
        if (in.method() == PaymentMethod.CREDIT) throw ApiException.badRequest("Un abono no puede ser a fiado");
        BigDecimal bal = balance(c.getId());
        if (in.amount().compareTo(bal) > 0) {
            throw ApiException.badRequest("El abono (" + in.amount() + ") es mayor que el saldo (" + bal + ")");
        }
        CustomerPayment a = new CustomerPayment();
        a.setVenueId(me.venueId());
        a.setCustomerId(c.getId());
        a.setAmount(in.amount());
        a.setMethod(in.method());
        a.setNote(blank(in.note()));
        a.setCreatedBy(me.id());
        if (in.method() == PaymentMethod.CASH) {
            CashShift shift = cash.requireOpen(me.venueId());
            CashMovement m = cash.record(me, shift, CashMovement.Direction.IN, CashMovement.Category.CUSTOMER_PAYMENT, "CASH",
                    in.amount(), "Abono de " + c.getName());
            a.setShiftId(shift.getId());
            a.setCashMovementId(m.getId());
        }
        abonos.save(a);
        audit.log(me, me.venueId(), "Registró abono de cliente", "customer", c.getId(),
                c.getName() + " · " + in.amount() + " · " + in.method());
        return detail(me.venueId(), c.getId());
    }

    @Transactional
    public CustomerDtos.Detail voidPayment(StaffPrincipal me, Long abonoId) {
        CustomerPayment a = abonos.findById(abonoId).filter(x -> x.getVenueId().equals(me.venueId()))
                .orElseThrow(() -> ApiException.notFound("Abono no encontrado"));
        Customer c = owned(me.venueId(), a.getCustomerId());
        if (a.isVoided()) return detail(me.venueId(), c.getId());
        if (a.getCashMovementId() != null) {
            cash.reverseCustomerPayment(me, a.getCashMovementId(), "Anulación de abono de " + c.getName(), a.getAmount());
        }
        a.setVoided(true);
        audit.log(me, me.venueId(), "Anuló abono de cliente", "customer", c.getId(),
                c.getName() + " · " + a.getAmount() + " · " + a.getMethod());
        return detail(me.venueId(), c.getId());
    }

    // ---------- Internos ----------

    public Customer owned(Long venueId, Long id) {
        return customers.findById(id).filter(c -> c.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Cliente no encontrado"));
    }

    private List<CustomerDtos.Row> rows(Long venueId) {
        Map<Long, BigDecimal> bal = new HashMap<>();
        Map<Long, Instant> last = new HashMap<>();
        for (Payment p : payments.findByVenueIdAndMethodAndVoidedFalse(venueId, PaymentMethod.CREDIT)) {
            if (p.getCustomerId() == null) continue;
            bal.merge(p.getCustomerId(), p.getTotal(), BigDecimal::add);
            last.merge(p.getCustomerId(), p.getCollectedAt(), (x, y) -> x.isAfter(y) ? x : y);
        }
        for (CustomerPayment a : abonos.findByVenueIdAndVoidedFalse(venueId)) {
            bal.merge(a.getCustomerId(), a.getAmount().negate(), BigDecimal::add);
            last.merge(a.getCustomerId(), a.getCreatedAt(), (x, y) -> x.isAfter(y) ? x : y);
        }
        return customers.findByVenueIdAndArchivedFalseOrderByNameAsc(venueId).stream()
                .map(c -> row(c, bal.getOrDefault(c.getId(), BigDecimal.ZERO), last.get(c.getId())))
                .sorted(Comparator.comparing(CustomerDtos.Row::balance).reversed()
                        .thenComparing(CustomerDtos.Row::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static CustomerDtos.Row row(Customer c, BigDecimal balance, Instant last) {
        return new CustomerDtos.Row(c.getId(), c.getName(), c.getPhone(), c.getNote(), balance, last);
    }

    private void ensureUniqueName(Long venueId, String name, Long exceptId) {
        boolean dup = customers.findByVenueIdAndArchivedFalseOrderByNameAsc(venueId).stream()
                .anyMatch(c -> c.getName().equalsIgnoreCase(name) && !c.getId().equals(exceptId));
        if (dup) throw ApiException.conflict("Ya hay un cliente con ese nombre");
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
