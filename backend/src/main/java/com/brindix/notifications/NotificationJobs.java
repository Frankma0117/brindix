package com.brindix.notifications;

import com.brindix.cash.CashShift;
import com.brindix.cash.CashShiftRepository;
import com.brindix.customers.CustomerDtos;
import com.brindix.customers.CustomerService;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.brindix.orders.Payment;
import com.brindix.orders.PaymentRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.IsoFields;

/** Avisos por tiempo: turno de caja abierto hace mucho y fiados viejos. */
@Component
public class NotificationJobs {

    private static final Logger log = LoggerFactory.getLogger(NotificationJobs.class);
    static final Duration SHIFT_LIMIT = Duration.ofHours(14);
    static final int DEBT_DAYS = 15;

    private final VenueRepository venues;
    private final CashShiftRepository shifts;
    private final CustomerService customers;
    private final NotificationService notifications;
    private final PaymentRepository payments;

    public NotificationJobs(VenueRepository venues, CashShiftRepository shifts, CustomerService customers,
                            NotificationService notifications, PaymentRepository payments) {
        this.payments = payments;
        this.venues = venues;
        this.shifts = shifts;
        this.customers = customers;
        this.notifications = notifications;
    }

    @Scheduled(cron = "0 5 * * * *")
    public void hourly() {
        for (Venue v : venues.findAllByOrderByNameAsc()) {
            if (!v.isActive()) continue;
            try {
                check(v.getId());
            } catch (RuntimeException e) {
                log.warn("Avisos del bar {}: {}", v.getId(), e.getMessage());
            }
        }
    }

    void check(Long venueId) {
        shifts.findFirstByVenueIdAndStatus(venueId, CashShift.Status.OPEN).ifPresent(s -> {
            if (s.getOpenedAt().isBefore(Instant.now().minus(SHIFT_LIMIT))) {
                notifications.push(venueId, "SHIFT_OPEN", "Turno de caja abierto hace más de 14 horas",
                        "Revisa si olvidaron cerrarlo.", "caja", "shift-open:" + s.getId());
            }
        });
        LocalDate today = LocalDate.now(ZoneId.of("America/Bogota"));
        List<Payment> pending = payments.findByVenueIdAndSettledFalseAndVoidedFalseOrderByCollectedAtAsc(venueId);
        if (!pending.isEmpty()) {
            BigDecimal total = pending.stream().map(Payment::getTotal).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
            notifications.push(venueId, "PAYMENTS_PENDING", pending.size() + " cobro(s) de meseros sin entregar en caja",
                    "Total por recibir: " + total.stripTrailingZeros().toPlainString(), "caja", "payments-pending:" + today);
        }
        String week = today.get(IsoFields.WEEK_BASED_YEAR) + "-" + today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        for (CustomerDtos.Row c : customers.staleDebtors(venueId, DEBT_DAYS)) {
            notifications.push(venueId, "DEBT_OLD", c.name() + " debe hace más de " + DEBT_DAYS + " días",
                    "Saldo pendiente: " + c.balance().stripTrailingZeros().toPlainString(), "fiados", "debt:" + c.id() + ":" + week);
        }
    }
}
