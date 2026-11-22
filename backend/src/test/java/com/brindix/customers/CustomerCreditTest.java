package com.brindix.customers;

import com.brindix.audit.AuditService;
import com.brindix.cash.*;
import com.brindix.common.ApiException;
import com.brindix.orders.Payment;
import com.brindix.orders.PaymentMethod;
import com.brindix.orders.PaymentRepository;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.Role;
import com.brindix.staff.StaffUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/** Reglas del fiado: saldo, abonos y efecto en el efectivo esperado, con repositorios en memoria. */
class CustomerCreditTest {

    private final List<Payment> paymentStore = new ArrayList<>();
    private final List<CustomerPayment> abonoStore = new ArrayList<>();
    private final List<CashMovement> moveStore = new ArrayList<>();
    private final StaffPrincipal admin = new StaffPrincipal(1L, 1L, "admin", "Admin", Role.ADMIN, false);
    private CashService cash;
    private CustomerService service;
    private CashShift shift;

    @BeforeEach
    void setUp() {
        PaymentRepository payments = mock(PaymentRepository.class);
        when(payments.findByCustomerIdOrderByCollectedAtDesc(anyLong())).thenAnswer(i -> paymentStore.stream()
                .filter(p -> i.getArgument(0).equals(p.getCustomerId())).toList());
        when(payments.findByShiftIdOrderByCollectedAtAsc(anyLong())).thenAnswer(i -> new ArrayList<>(paymentStore));

        CustomerPaymentRepository abonos = mock(CustomerPaymentRepository.class);
        when(abonos.findByCustomerIdOrderByCreatedAtDesc(anyLong())).thenAnswer(i -> abonoStore.stream()
                .filter(a -> i.getArgument(0).equals(a.getCustomerId())).toList());
        when(abonos.findById(anyLong())).thenAnswer(i -> abonoStore.stream().filter(a -> i.getArgument(0).equals(a.getId())).findFirst());
        when(abonos.save(any(CustomerPayment.class))).thenAnswer(i -> {
            CustomerPayment a = i.getArgument(0);
            if (a.getId() == null) a.setId((long) abonoStore.size() + 1);
            abonoStore.add(a);
            return a;
        });

        CashMovementRepository movements = mock(CashMovementRepository.class);
        when(movements.save(any(CashMovement.class))).thenAnswer(i -> {
            CashMovement m = i.getArgument(0);
            m.setId((long) moveStore.size() + 1);
            moveStore.add(m);
            return m;
        });
        when(movements.findByShiftIdOrderByCreatedAtAsc(anyLong())).thenAnswer(i -> new ArrayList<>(moveStore));

        shift = new CashShift();
        shift.setId(10L);
        shift.setVenueId(1L);
        shift.setOpeningCash(new BigDecimal("100000"));
        CashShiftRepository shifts = mock(CashShiftRepository.class);
        when(shifts.findFirstByVenueIdAndStatus(1L, CashShift.Status.OPEN)).thenReturn(Optional.of(shift));

        AuditService audit = mock(AuditService.class);
        cash = new CashService(shifts, movements, payments, mock(StaffUserRepository.class), audit);

        Customer c = new Customer();
        c.setId(5L);
        c.setVenueId(1L);
        c.setName("Pedro");
        CustomerRepository customers = mock(CustomerRepository.class);
        when(customers.findById(5L)).thenReturn(Optional.of(c));
        service = new CustomerService(customers, abonos, payments, cash, mock(StaffUserRepository.class), audit);
    }

    private void fiado(String total) {
        Payment p = new Payment();
        p.setId((long) paymentStore.size() + 1);
        p.setVenueId(1L);
        p.setShiftId(10L);
        p.setCustomerId(5L);
        p.setMethod(PaymentMethod.CREDIT);
        p.setTotal(new BigDecimal(total));
        p.setSubtotal(new BigDecimal(total));
        p.setSettled(true);
        paymentStore.add(p);
    }

    private static CustomerDtos.PaymentInput abono(String amount, PaymentMethod m) {
        return new CustomerDtos.PaymentInput(new BigDecimal(amount), m, null);
    }

    @Test
    void fiadoSumaSaldoYAbonoLoBaja() {
        fiado("30000");
        fiado("20000");
        assertEquals(0, new BigDecimal("50000").compareTo(service.balance(5L)));
        service.addPayment(admin, 5L, abono("15000", PaymentMethod.TRANSFER));
        assertEquals(0, new BigDecimal("35000").compareTo(service.balance(5L)));
    }

    @Test
    void clientePreferencialSeGuardaYSeMantiene() {
        CustomerDtos.Row r = service.update(admin, 5L, new CustomerDtos.CustomerInput("Pedro", null, null, true));
        assertTrue(r.preferred());
        r = service.update(admin, 5L, new CustomerDtos.CustomerInput("Pedro", null, null, null));
        assertTrue(r.preferred(), "null no cambia el valor");
    }

    @Test
    void abonoMayorAlSaldoFalla() {
        fiado("10000");
        assertThrows(ApiException.class, () -> service.addPayment(admin, 5L, abono("10001", PaymentMethod.CASH)));
        assertEquals(0, new BigDecimal("10000").compareTo(service.balance(5L)));
    }

    @Test
    void fiadoNoCuentaEnEfectivoEsperadoPeroAbonoEnEfectivoSi() {
        fiado("40000");
        CashDtos.ShiftStatus before = cash.status(shift);
        assertEquals(0, new BigDecimal("100000").compareTo(before.expectedCash()));
        assertEquals(0, new BigDecimal("40000").compareTo(before.creditTotal()));
        assertEquals(0, new BigDecimal("40000").compareTo(before.salesTotal()));

        service.addPayment(admin, 5L, abono("12000", PaymentMethod.TRANSFER));
        assertEquals(0, new BigDecimal("100000").compareTo(cash.status(shift).expectedCash()));

        service.addPayment(admin, 5L, abono("8000", PaymentMethod.CASH));
        assertEquals(0, new BigDecimal("108000").compareTo(cash.status(shift).expectedCash()));
    }

    @Test
    void anularAbonoEnEfectivoRevierteLaCaja() {
        fiado("40000");
        service.addPayment(admin, 5L, abono("8000", PaymentMethod.CASH));
        service.voidPayment(admin, abonoStore.get(0).getId());
        assertEquals(0, new BigDecimal("40000").compareTo(service.balance(5L)));
        assertEquals(0, new BigDecimal("100000").compareTo(cash.status(shift).expectedCash()));
    }
}
