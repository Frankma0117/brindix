package com.brindix.reports;

import com.brindix.audit.AuditService;
import com.brindix.cash.CashDtos;
import com.brindix.cash.CashService;
import com.brindix.cash.CashShift;
import com.brindix.catalog.ProductRepository;
import com.brindix.common.AppProperties;
import com.brindix.music.SongRequestRepository;
import com.brindix.music.SongStatus;
import com.brindix.orders.*;
import com.brindix.staff.StaffUser;
import com.brindix.staff.StaffUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Ventas y ganancias a partir de los cobros. La ganancia usa el costo congelado en cada producto
 * vendido (round_items.unit_cost). El día contable de un bar va de 6:00 a. m. a 6:00 a. m.
 */
@Service
public class ReportService {

    private final PaymentRepository payments;
    private final RoundRepository rounds;
    private final TabRepository tabs;
    private final ServiceCallRepository calls;
    private final ProductRepository products;
    private final StaffUserRepository users;
    private final SongRequestRepository songs;
    private final CashService cash;
    private final AuditService audit;
    private final ZoneId zone;

    public ReportService(PaymentRepository payments, RoundRepository rounds, TabRepository tabs, ServiceCallRepository calls,
                         ProductRepository products, StaffUserRepository users, SongRequestRepository songs, CashService cash,
                         AuditService audit, AppProperties props) {
        this.payments = payments;
        this.rounds = rounds;
        this.tabs = tabs;
        this.calls = calls;
        this.products = products;
        this.users = users;
        this.songs = songs;
        this.cash = cash;
        this.audit = audit;
        this.zone = props.zone();
    }

    public record Totals(BigDecimal sales, BigDecimal subtotal, BigDecimal discounts, BigDecimal tips, int payments, int tabs,
                         BigDecimal averageTicket, int itemsSold, BigDecimal cost, BigDecimal profit, BigDecimal marginPct) {}

    public record Bucket(String key, BigDecimal total, int count) {}

    public record ProductSales(Long productId, String name, int quantity, BigDecimal revenue, BigDecimal cost, BigDecimal profit) {}

    public record Summary(LocalDate from, LocalDate to, Totals totals, List<Bucket> byPayment, List<Bucket> byDay,
                         List<Bucket> byHour, List<Bucket> byWaiter, List<ProductSales> products) {}

    public record Live(int openTabs, BigDecimal openConsumed, BigDecimal openDue, int pendingOrders, int inProgress, int openCalls,
                       int lowStock, int songsQueued, int songsPending, boolean cashOpen, BigDecimal expectedCash,
                       int unsettledCount, BigDecimal unsettledTotal) {}

    public record Dashboard(Summary today, Live live) {}

    /** Cierre de caja: todo lo del turno para contar el dinero y cuadrar. */
    public record ShiftReport(Long shiftId, String status, Instant openedAt, Instant closedAt, String openedBy, String closedBy,
                              CashDtos.ShiftStatus cash, BigDecimal countedCash, BigDecimal difference, String openingNote,
                              String closingNote, Totals totals, List<Bucket> byPayment, List<Bucket> byWaiter,
                              List<ProductSales> products, List<AuditService.AuditView> sensitive,
                              int openTabs, BigDecimal openDue) {}

    @Transactional(readOnly = true)
    public Summary summary(Long venueId, LocalDate from, LocalDate to) {
        Instant start = from.atTime(6, 0).atZone(zone).toInstant();
        Instant end = to.plusDays(1).atTime(6, 0).atZone(zone).toInstant();
        List<Payment> ps = payments.findBetween(venueId, start, end);
        Agg a = aggregate(venueId, ps);
        Map<String, Bucket> byDay = new TreeMap<>(), byHour = new TreeMap<>();
        for (Payment p : ps) {
            add(byDay, LocalDateTime.ofInstant(p.getCollectedAt(), zone).minusHours(6).toLocalDate().toString(), p.getTotal());
            add(byHour, String.format("%02d", LocalDateTime.ofInstant(p.getCollectedAt(), zone).getHour()), p.getTotal());
        }
        return new Summary(from, to, a.totals, a.byPayment, new ArrayList<>(byDay.values()), new ArrayList<>(byHour.values()), a.byWaiter, a.products);
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(Long venueId) {
        LocalDate today = LocalDateTime.now(zone).minusHours(6).toLocalDate();
        List<Tab> open = tabs.findByVenueIdAndStatus(venueId, TabStatus.OPEN);
        BigDecimal consumed = BigDecimal.ZERO, due = BigDecimal.ZERO;
        int inProgress = 0;
        if (!open.isEmpty()) {
            for (Round r : rounds.findByTabIdIn(open.stream().map(Tab::getId).toList())) {
                if (r.getStatus().counts()) consumed = consumed.add(r.total());
                if (r.payable()) due = due.add(r.total());
                if (r.getStatus() == RoundStatus.CONFIRMED) inProgress++;
            }
        }
        Optional<CashShift> shift = cash.current(venueId);
        CashDtos.ShiftStatus st = shift.map(cash::status).orElse(null);
        Live live = new Live(open.size(), consumed, due, rounds.findPending(venueId).size(), inProgress,
                calls.findByVenueIdAndStatusOrderByCreatedAtAsc(venueId, CallStatus.OPEN).size(),
                products.findLowStock(venueId).size(),
                songs.findByVenueIdAndStatus(venueId, SongStatus.QUEUED).size(),
                songs.findByVenueIdAndStatus(venueId, SongStatus.PENDING).size(),
                st != null, st == null ? null : st.expectedCash(),
                st == null ? 0 : st.unsettledCount(), st == null ? BigDecimal.ZERO : st.unsettledTotal());
        return new Dashboard(summary(venueId, today, today), live);
    }

    @Transactional(readOnly = true)
    public ShiftReport shift(Long venueId, Long shiftId) {
        CashShift s = shiftId == null ? cash.current(venueId).orElseThrow(() -> com.brindix.common.ApiException.notFound("No hay turno abierto"))
                : cash.owned(venueId, shiftId);
        List<Payment> ps = payments.findByShiftIdOrderByCollectedAtAsc(s.getId()).stream().filter(p -> !p.isVoided()).toList();
        Agg a = aggregate(venueId, ps);
        Map<Long, String> names = names(venueId);
        List<AuditService.AuditView> sensitive = audit.list(venueId, null, null, s.getOpenedAt(), 500).stream()
                .filter(x -> s.getClosedAt() == null || !x.createdAt().isAfter(s.getClosedAt()))
                .filter(x -> Set.of("Anuló producto", "Cambió cantidad", "Anuló cobro", "Rechazó pedido", "Merma",
                        "Ajuste de inventario", "Borró movimiento de caja", "Cambió precio/costo").contains(x.action()))
                .toList();
        List<Tab> open = tabs.findByVenueIdAndStatus(venueId, TabStatus.OPEN);
        BigDecimal openDue = open.isEmpty() ? BigDecimal.ZERO : rounds.findByTabIdIn(open.stream().map(Tab::getId).toList()).stream()
                .filter(Round::payable).map(Round::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ShiftReport(s.getId(), s.getStatus().name(), s.getOpenedAt(), s.getClosedAt(), names.get(s.getOpenedBy()),
                names.get(s.getClosedBy()), cash.status(s), s.getCountedCash(), s.getDifference(), s.getOpeningNote(), s.getClosingNote(),
                a.totals, a.byPayment, a.byWaiter, a.products, sensitive, open.size(), openDue);
    }

    // ------------------------------------------------------------------

    private record Agg(Totals totals, List<Bucket> byPayment, List<Bucket> byWaiter, List<ProductSales> products) {}

    private Agg aggregate(Long venueId, List<Payment> ps) {
        BigDecimal sales = sum(ps.stream().map(Payment::getTotal).toList());
        BigDecimal subtotal = sum(ps.stream().map(Payment::getSubtotal).toList());
        BigDecimal discounts = sum(ps.stream().map(Payment::getDiscount).toList());
        BigDecimal tips = sum(ps.stream().map(Payment::getTip).toList());
        Map<String, Bucket> byPayment = new TreeMap<>(), byWaiter = new TreeMap<>();
        Map<Long, String> names = names(venueId);
        for (Payment p : ps) {
            add(byPayment, p.getMethod().name(), p.getTotal());
            add(byWaiter, names.getOrDefault(p.getCollectedBy(), "?"), p.getTotal());
        }
        List<Round> paid = ps.isEmpty() ? List.of() : rounds.findByPaymentIdIn(ps.stream().map(Payment::getId).toList());
        Map<Long, ProductSales> byProduct = new HashMap<>();
        int itemsSold = 0;
        BigDecimal cost = BigDecimal.ZERO;
        for (Round r : paid) {
            for (RoundItem i : r.getItems()) {
                if (i.isVoided()) continue;
                itemsSold += i.getQuantity();
                cost = cost.add(i.lineCost());
                ProductSales add = new ProductSales(i.getProductId(), i.getProductName(), i.getQuantity(), i.lineTotal(), i.lineCost(),
                        i.lineTotal().subtract(i.lineCost()));
                byProduct.merge(i.getProductId(), add, (x, y) -> new ProductSales(x.productId(), x.name(), x.quantity() + y.quantity(),
                        x.revenue().add(y.revenue()), x.cost().add(y.cost()), x.profit().add(y.profit())));
            }
        }
        long tabCount = ps.stream().map(Payment::getTabId).distinct().count();
        BigDecimal net = subtotal.subtract(discounts);
        BigDecimal profit = net.subtract(cost);
        BigDecimal avg = tabCount == 0 ? BigDecimal.ZERO : sales.divide(BigDecimal.valueOf(tabCount), 0, RoundingMode.HALF_UP);
        BigDecimal pct = net.signum() == 0 ? BigDecimal.ZERO : profit.multiply(BigDecimal.valueOf(100)).divide(net, 1, RoundingMode.HALF_UP);
        List<ProductSales> top = byProduct.values().stream().sorted(Comparator.comparing(ProductSales::revenue).reversed()).toList();
        List<Bucket> waiters = byWaiter.values().stream().sorted(Comparator.comparing(Bucket::total).reversed()).toList();
        return new Agg(new Totals(sales, subtotal, discounts, tips, ps.size(), (int) tabCount, avg, itemsSold, cost, profit, pct),
                new ArrayList<>(byPayment.values()), waiters, top);
    }

    private Map<Long, String> names(Long venueId) {
        return users.findByVenueIdOrderByNameAsc(venueId).stream().collect(Collectors.toMap(StaffUser::getId, StaffUser::getName));
    }

    private static void add(Map<String, Bucket> map, String key, BigDecimal value) {
        map.merge(key, new Bucket(key, value, 1), (a, b) -> new Bucket(key, a.total().add(b.total()), a.count() + 1));
    }

    private static BigDecimal sum(List<BigDecimal> list) {
        return list.stream().filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
