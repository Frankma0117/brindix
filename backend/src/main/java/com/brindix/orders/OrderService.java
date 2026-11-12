package com.brindix.orders;

import com.brindix.audit.AuditService;
import com.brindix.cash.CashService;
import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.common.ApiException;
import com.brindix.inventory.InventoryService;
import com.brindix.inventory.MovementType;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.Role;
import com.brindix.staff.StaffUser;
import com.brindix.staff.StaffUserRepository;
import com.brindix.tables.BarTable;
import com.brindix.tables.BarTableRepository;
import com.brindix.tables.TableService;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Cuentas, rondas y pedidos. Reglas:
 * - El mesero solo agrega rondas, entrega y (si el bar lo permite) cobra.
 * - Modificar (cambiar cantidades, anular, rechazar, asignar) es del administrador y queda en la bitácora.
 * - Lo que ya se cobró no se modifica: primero se anula el cobro.
 */
@Service
public class OrderService {

    private static final int MAX_PENDING_CLIENT_ROUNDS = 3;

    private final TabRepository tabs;
    private final RoundRepository rounds;
    private final RoundItemRepository items;
    private final PaymentRepository payments;
    private final ServiceCallRepository calls;
    private final ProductRepository products;
    private final BarTableRepository tables;
    private final StaffUserRepository users;
    private final TableService tableService;
    private final InventoryService inventory;
    private final VenueService venues;
    private final CashService cash;
    private final AuditService audit;

    public OrderService(TabRepository tabs, RoundRepository rounds, RoundItemRepository items, PaymentRepository payments,
                        ServiceCallRepository calls, ProductRepository products, BarTableRepository tables,
                        StaffUserRepository users, TableService tableService, InventoryService inventory,
                        VenueService venues, CashService cash, AuditService audit) {
        this.tabs = tabs;
        this.rounds = rounds;
        this.items = items;
        this.payments = payments;
        this.calls = calls;
        this.products = products;
        this.tables = tables;
        this.users = users;
        this.tableService = tableService;
        this.inventory = inventory;
        this.venues = venues;
        this.cash = cash;
        this.audit = audit;
    }

    // =====================================================================
    // Tablero
    // =====================================================================

    @Transactional(readOnly = true)
    public OrderDtos.Board board(StaffPrincipal me) {
        Long venueId = me.venueId();
        List<BarTable> list = tables.findByVenueIdOrderBySortOrderAscNameAsc(venueId).stream().filter(BarTable::isActive).toList();
        Map<Long, Tab> openByTable = tabs.findByVenueIdAndStatus(venueId, TabStatus.OPEN).stream()
                .collect(Collectors.toMap(Tab::getTableId, Function.identity(), (a, b) -> a));
        Map<Long, List<Round>> roundsByTab = openByTable.isEmpty() ? Map.of()
                : rounds.findByTabIdIn(openByTable.values().stream().map(Tab::getId).toList()).stream()
                .collect(Collectors.groupingBy(Round::getTabId));
        Map<Long, List<CallType>> callsByTable = calls.findByVenueIdAndStatusOrderByCreatedAtAsc(venueId, CallStatus.OPEN).stream()
                .collect(Collectors.groupingBy(ServiceCall::getTableId, Collectors.mapping(ServiceCall::getType, Collectors.toList())));
        Map<Long, String> names = staffNames(venueId);

        List<OrderDtos.TableBoard> out = new ArrayList<>();
        for (BarTable t : list) {
            Tab tab = openByTable.get(t.getId());
            List<Round> rs = tab == null ? List.of() : roundsByTab.getOrDefault(tab.getId(), List.of());
            out.add(new OrderDtos.TableBoard(t.getId(), t.getName(), t.getZone(), t.getSeats(), t.getCode(),
                    tab == null ? null : tab.getId(), tab == null ? null : tab.getCustomerName(),
                    tab == null ? null : names.get(tab.getWaiterId()), tab == null ? null : tab.getOpenedAt(),
                    consumed(rs), due(rs), itemCount(rs),
                    (int) rs.stream().filter(r -> r.getStatus() == RoundStatus.PENDING).count(),
                    (int) rs.stream().filter(r -> r.getStatus() == RoundStatus.CONFIRMED).count(),
                    callsByTable.getOrDefault(t.getId(), List.of())));
        }
        Map<Long, String> tableNames = list.stream().collect(Collectors.toMap(BarTable::getId, BarTable::getName));
        Map<Long, Long> tableOfTab = openByTable.values().stream().collect(Collectors.toMap(Tab::getId, Tab::getTableId));
        List<OrderDtos.RoundView> pending = rounds.findPending(venueId).stream()
                .map(r -> roundView(r, tableNames.get(tableOfTab.get(r.getTabId())), names)).toList();
        List<OrderDtos.RoundView> inProgress = rounds.findInProgress(venueId).stream()
                .filter(r -> me.isAdmin() || me.id().equals(r.getAssignedTo()))
                .map(r -> roundView(r, tableNames.get(tableOfTab.get(r.getTabId())), names)).toList();
        List<OrderDtos.CallView> callViews = calls.findByVenueIdAndStatusOrderByCreatedAtAsc(venueId, CallStatus.OPEN).stream()
                .map(c -> new OrderDtos.CallView(c.getId(), c.getTableId(), tableNames.get(c.getTableId()), c.getType(), c.getCreatedAt())).toList();
        return new OrderDtos.Board(out, pending, inProgress, callViews, cash.current(venueId).isPresent(), canCharge(me));
    }

    // =====================================================================
    // Cuentas
    // =====================================================================

    @Transactional
    public OrderDtos.TabView openTab(StaffPrincipal me, Long tableId, OrderDtos.OpenInput in) {
        BarTable table = tableService.owned(me.venueId(), tableId);
        Tab tab = tabs.findFirstByTableIdAndStatus(table.getId(), TabStatus.OPEN).orElse(null);
        if (tab == null) {
            tab = newTab(table, me.id());
            tab.setWaiterId(me.id());
        }
        if (in != null) {
            if (in.customerName() != null && !in.customerName().isBlank()) tab.setCustomerName(in.customerName().trim());
            if (in.notes() != null && !in.notes().isBlank()) tab.setNotes(in.notes().trim());
            if (in.waiterId() != null && me.isAdmin()) tab.setWaiterId(waiter(me.venueId(), in.waiterId()).getId());
        }
        return tabView(me, tab);
    }

    @Transactional(readOnly = true)
    public OrderDtos.TabView tab(StaffPrincipal me, Long tabId) {
        return tabView(me, ownedTab(me.venueId(), tabId));
    }

    /** Mesero o administrador cargan una ronda: queda confirmada y descuenta inventario. */
    @Transactional
    public OrderDtos.TabView addRound(StaffPrincipal me, Long tabId, OrderDtos.RoundInput in) {
        Tab tab = openTabOrFail(me.venueId(), tabId);
        Round round = buildRound(tab, in.items(), me.venueId(), false);
        round.setSource(me.isAdmin() ? RoundSource.ADMIN : RoundSource.WAITER);
        round.setStatus(RoundStatus.CONFIRMED);
        round.setCreatedBy(me.id());
        round.setHandledBy(me.id());
        Long assignee = in.assignedTo() != null && me.isAdmin() ? waiter(me.venueId(), in.assignedTo()).getId()
                : me.isAdmin() && tab.getWaiterId() != null ? tab.getWaiterId() : me.id();
        round.setAssignedTo(assignee);
        round.setConfirmedAt(Instant.now());
        round.setNote(trim(in.note()));
        round = rounds.save(round);
        discountStock(round, tab, me.id());
        return tabView(me, tab);
    }

    /** El administrador asigna un pedido del cliente (o reasigna una ronda) a un mesero. */
    @Transactional
    public OrderDtos.TabView assign(StaffPrincipal me, Long roundId, Long waiterId) {
        Round round = ownedRound(me.venueId(), roundId);
        Tab tab = openTabOrFail(me.venueId(), round.getTabId());
        StaffUser w = waiter(me.venueId(), waiterId);
        if (round.getStatus() == RoundStatus.PENDING) {
            round.setStatus(RoundStatus.CONFIRMED);
            round.setConfirmedAt(Instant.now());
            round.setHandledBy(me.id());
            round.setAssignedTo(w.getId());
            if (tab.getWaiterId() == null) tab.setWaiterId(w.getId());
            discountStock(round, tab, me.id());
            audit.log(me, me.venueId(), "Asignó pedido", "round", round.getId(), "Mesa " + tableName(tab) + " → " + w.getName());
        } else if (round.getStatus() == RoundStatus.CONFIRMED) {
            round.setAssignedTo(w.getId());
            audit.log(me, me.venueId(), "Reasignó ronda", "round", round.getId(), "Mesa " + tableName(tab) + " → " + w.getName());
        } else {
            throw ApiException.conflict("Esa ronda ya fue entregada o rechazada");
        }
        return tabView(me, tab);
    }

    @Transactional
    public OrderDtos.TabView reject(StaffPrincipal me, Long roundId, String reason) {
        Round round = ownedRound(me.venueId(), roundId);
        if (round.getStatus() != RoundStatus.PENDING) {
            throw ApiException.conflict("Solo se rechazan pedidos pendientes. Para quitar algo confirmado, anula el producto.");
        }
        round.setStatus(RoundStatus.REJECTED);
        round.setHandledBy(me.id());
        round.setRejectReason(trim(reason) == null ? "No disponible" : trim(reason));
        audit.log(me, me.venueId(), "Rechazó pedido", "round", round.getId(), round.getRejectReason());
        return tabView(me, ownedTab(me.venueId(), round.getTabId()));
    }

    /** Marcar entregada: el mesero asignado o el administrador. */
    @Transactional
    public OrderDtos.TabView deliver(StaffPrincipal me, Long roundId) {
        Round round = ownedRound(me.venueId(), roundId);
        if (round.getStatus() != RoundStatus.CONFIRMED) throw ApiException.conflict("La ronda debe estar confirmada");
        if (!me.isAdmin() && round.getAssignedTo() != null && !round.getAssignedTo().equals(me.id())) {
            throw ApiException.forbidden("Esta ronda la lleva otro mesero");
        }
        round.setStatus(RoundStatus.DELIVERED);
        round.setDeliveredAt(Instant.now());
        return tabView(me, ownedTab(me.venueId(), round.getTabId()));
    }

    /** Cambiar la cantidad de un producto (solo administrador, sin cobrar todavía). Ajusta el inventario. */
    @Transactional
    public OrderDtos.TabView changeQuantity(StaffPrincipal me, Long itemId, OrderDtos.QuantityInput in) {
        RoundItem item = editableItem(me, itemId);
        Round round = item.getRound();
        int delta = in.quantity() - item.getQuantity();
        if (delta == 0) return tabView(me, ownedTab(me.venueId(), round.getTabId()));
        Tab tab = ownedTab(me.venueId(), round.getTabId());
        if (round.getStatus().counts()) {
            products.findById(item.getProductId()).ifPresent(p -> inventory.move(p, delta > 0 ? MovementType.SALE : MovementType.RETURN,
                    -delta, p.getCost(), null, "Cuenta #" + tab.getId(), "Cambio de cantidad: " + in.reason(), me.id(), tab.getId()));
        }
        audit.log(me, me.venueId(), "Cambió cantidad", "round", round.getId(),
                "Mesa " + tableName(tab) + " · " + item.getProductName() + ": " + item.getQuantity() + " → " + in.quantity() + " · " + in.reason());
        item.setQuantity(in.quantity());
        return tabView(me, tab);
    }

    /** Anular un producto (solo administrador, sin cobrar todavía). Vuelve al inventario. */
    @Transactional
    public OrderDtos.TabView voidItem(StaffPrincipal me, Long itemId, String reason) {
        if (trim(reason) == null) throw ApiException.badRequest("Escribe el motivo de la anulación");
        RoundItem item = editableItem(me, itemId);
        Round round = item.getRound();
        Tab tab = ownedTab(me.venueId(), round.getTabId());
        item.setVoided(true);
        item.setVoidReason(trim(reason) + " (" + me.name() + ")");
        if (round.getStatus().counts()) {
            products.findById(item.getProductId()).ifPresent(p ->
                    inventory.move(p, MovementType.RETURN, item.getQuantity(), p.getCost(), null,
                            "Cuenta #" + tab.getId(), "Anulado: " + trim(reason), me.id(), tab.getId()));
        }
        audit.log(me, me.venueId(), "Anuló producto", "round", round.getId(),
                "Mesa " + tableName(tab) + " · " + item.getQuantity() + " × " + item.getProductName() + " · " + reason);
        return tabView(me, tab);
    }

    /** Liberar la mesa: solo si todo lo consumido está pago. */
    @Transactional
    public OrderDtos.TabView release(StaffPrincipal me, Long tabId) {
        Tab tab = openTabOrFail(me.venueId(), tabId);
        List<Round> rs = rounds.findByTabIdOrderByCreatedAtAsc(tab.getId());
        if (due(rs).signum() > 0) throw ApiException.conflict("Falta cobrar " + due(rs) + " antes de liberar la mesa");
        for (Round r : rs) {
            if (r.getStatus() == RoundStatus.PENDING) {
                r.setStatus(RoundStatus.REJECTED);
                r.setRejectReason("Cuenta cerrada");
                r.setHandledBy(me.id());
            }
        }
        tab.setStatus(consumed(rs).signum() == 0 ? TabStatus.CANCELLED : TabStatus.CLOSED);
        tab.setClosedAt(Instant.now());
        tab.setClosedBy(me.id());
        resolveCalls(tab.getTableId(), me.id());
        return tabView(me, tab);
    }

    @Transactional
    public OrderDtos.TabView moveTab(StaffPrincipal me, Long tabId, Long targetTableId) {
        Tab tab = openTabOrFail(me.venueId(), tabId);
        BarTable target = tableService.owned(me.venueId(), targetTableId);
        if (tabs.findFirstByTableIdAndStatus(target.getId(), TabStatus.OPEN).isPresent()) {
            throw ApiException.conflict(target.getName() + " ya tiene una cuenta abierta");
        }
        String from = tableName(tab);
        resolveCalls(tab.getTableId(), me.id());
        tab.setTableId(target.getId());
        audit.log(me, me.venueId(), "Cambió de mesa", "tab", tab.getId(), from + " → " + target.getName());
        return tabView(me, tab);
    }

    @Transactional
    public OrderDtos.TabView setWaiter(StaffPrincipal me, Long tabId, Long waiterId) {
        Tab tab = openTabOrFail(me.venueId(), tabId);
        tab.setWaiterId(waiter(me.venueId(), waiterId).getId());
        return tabView(me, tab);
    }

    @Transactional
    public void resolveCall(StaffPrincipal me, Long callId) {
        ServiceCall c = calls.findById(callId).filter(x -> x.getVenueId().equals(me.venueId()))
                .orElseThrow(() -> ApiException.notFound("Llamado no encontrado"));
        c.setStatus(CallStatus.DONE);
        c.setDoneAt(Instant.now());
        c.setDoneBy(me.id());
    }

    // =====================================================================
    // Cliente (QR)
    // =====================================================================

    @Transactional
    public OrderDtos.PublicTab clientOrder(String slug, String code, OrderDtos.ClientOrderInput in) {
        Venue venue = venues.bySlug(slug);
        BarTable table = tableService.byCode(venue.getId(), code);
        if (!venue.isClientOrdersEnabled()) throw ApiException.forbidden("En este bar los pedidos se hacen con el mesero");
        Tab tab = tabs.findFirstByTableIdAndStatus(table.getId(), TabStatus.OPEN).orElseGet(() -> newTab(table, null));
        if (rounds.countByTabIdAndStatus(tab.getId(), RoundStatus.PENDING) >= MAX_PENDING_CLIENT_ROUNDS) {
            throw ApiException.tooMany("Ya tienes pedidos esperando confirmación. En un momento te atienden.");
        }
        Round round = buildRound(tab, in.items(), venue.getId(), true);
        round.setSource(RoundSource.CLIENT);
        round.setStatus(RoundStatus.PENDING);
        round.setClientName(trim(in.clientName()));
        round.setNote(trim(in.note()));
        rounds.save(round);
        return publicTab(table, tab);
    }

    @Transactional(readOnly = true)
    public OrderDtos.PublicTab clientTab(String slug, String code) {
        BarTable table = tableService.byCode(venues.bySlug(slug).getId(), code);
        return publicTab(table, tabs.findFirstByTableIdAndStatus(table.getId(), TabStatus.OPEN).orElse(null));
    }

    @Transactional
    public OrderDtos.PublicTab clientCall(String slug, String code, CallType type) {
        BarTable table = tableService.byCode(venues.bySlug(slug).getId(), code);
        if (calls.findFirstByTableIdAndTypeAndStatus(table.getId(), type, CallStatus.OPEN).isEmpty()) {
            ServiceCall c = new ServiceCall();
            c.setVenueId(table.getVenueId());
            c.setTableId(table.getId());
            c.setType(type);
            calls.save(c);
        }
        return publicTab(table, tabs.findFirstByTableIdAndStatus(table.getId(), TabStatus.OPEN).orElse(null));
    }

    // =====================================================================
    // Para PaymentService y reportes
    // =====================================================================

    public boolean canCharge(StaffPrincipal me) {
        return me.isAdmin() || venues.get(me.venueId()).isWaiterCanCharge();
    }

    public Tab openTabOrFail(Long venueId, Long tabId) {
        Tab tab = ownedTab(venueId, tabId);
        if (tab.getStatus() != TabStatus.OPEN) throw ApiException.conflict("Esa cuenta ya está cerrada");
        return tab;
    }

    public Tab ownedTab(Long venueId, Long tabId) {
        return tabs.findById(tabId).filter(t -> t.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Cuenta no encontrada"));
    }

    public String tableName(Tab tab) {
        return tables.findById(tab.getTableId()).map(BarTable::getName).orElse("?");
    }

    @Transactional(readOnly = true)
    public OrderDtos.TabView tabView(StaffPrincipal me, Tab tab) {
        List<Round> rs = rounds.findByTabIdOrderByCreatedAtAsc(tab.getId());
        Map<Long, String> names = staffNames(tab.getVenueId());
        String tableName = tableName(tab);
        List<Payment> ps = payments.findByTabIdOrderByCollectedAtAsc(tab.getId());
        BigDecimal paid = ps.stream().filter(p -> !p.isVoided()).map(Payment::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new OrderDtos.TabView(tab.getId(), tab.getTableId(), tableName, tab.getStatus(), tab.getCustomerName(),
                tab.getNotes(), tab.getWaiterId(), names.get(tab.getWaiterId()), names.get(tab.getOpenedBy()), names.get(tab.getClosedBy()),
                tab.getOpenedAt(), tab.getClosedAt(), consumed(rs), paid, due(rs), pendingTotal(rs), itemCount(rs),
                me != null && canCharge(me),
                rs.stream().map(r -> roundView(r, tableName, names)).toList(),
                ps.stream().map(p -> paymentView(p, tableName, names)).toList());
    }

    public OrderDtos.PaymentView paymentView(Payment p, String tableName, Map<Long, String> names) {
        return new OrderDtos.PaymentView(p.getId(), p.getTabId(), tableName, p.getSubtotal(), p.getDiscount(), p.getTip(), p.getTotal(),
                p.getMethod(), p.getNote(), names.get(p.getCollectedBy()), p.getCollectedAt(), p.isSettled(),
                names.get(p.getSettledBy()), p.isVoided(), p.getVoidReason());
    }

    public Map<Long, String> staffNames(Long venueId) {
        Map<Long, String> m = new HashMap<>();
        users.findByVenueIdOrderByNameAsc(venueId).forEach(u -> m.put(u.getId(), u.getName()));
        return m;
    }

    // =====================================================================
    // Internos
    // =====================================================================

    private RoundItem editableItem(StaffPrincipal me, Long itemId) {
        if (!me.isAdmin()) throw ApiException.forbidden("Solo el administrador puede modificar pedidos");
        RoundItem item = items.findById(itemId).orElseThrow(() -> ApiException.notFound("Producto no encontrado en la cuenta"));
        Round round = item.getRound();
        openTabOrFail(me.venueId(), round.getTabId());
        if (item.isVoided()) throw ApiException.conflict("Ese producto ya está anulado");
        if (round.getPaymentId() != null) throw ApiException.conflict("Esa ronda ya se cobró. Anula primero el cobro en Caja.");
        if (round.getStatus() == RoundStatus.REJECTED) throw ApiException.conflict("Esa ronda fue rechazada");
        return item;
    }

    private StaffUser waiter(Long venueId, Long id) {
        return users.findById(id).filter(u -> u.getVenueId().equals(venueId) && u.isActive() && u.getRole() != Role.SUPERADMIN)
                .orElseThrow(() -> ApiException.notFound("Mesero no encontrado"));
    }

    private Tab newTab(BarTable table, Long userId) {
        Tab tab = new Tab();
        tab.setVenueId(table.getVenueId());
        tab.setTableId(table.getId());
        tab.setOpenedBy(userId);
        return tabs.save(tab);
    }

    private Round buildRound(Tab tab, List<OrderDtos.ItemInput> lines, Long venueId, boolean fromClient) {
        Map<Long, Product> byId = products.findAllById(lines.stream().map(OrderDtos.ItemInput::productId).collect(Collectors.toSet()))
                .stream().filter(p -> p.getVenueId().equals(venueId) && !p.isArchived())
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        Round round = new Round();
        round.setTabId(tab.getId());
        for (OrderDtos.ItemInput line : lines) {
            Product p = byId.get(line.productId());
            if (p == null) throw ApiException.notFound("Un producto del pedido ya no existe");
            if (!p.isAvailable() || (fromClient && p.soldOut())) {
                throw ApiException.conflict("Lo sentimos, \"" + p.getName() + "\" no está disponible.");
            }
            if (fromClient && p.isTrackStock() && p.getStock() < line.quantity()) {
                throw ApiException.conflict("Solo quedan " + p.getStock() + " de \"" + p.getName() + "\"");
            }
            RoundItem item = new RoundItem();
            item.setProductId(p.getId());
            item.setProductName(p.getName());
            item.setUnitPrice(p.getPrice());
            item.setUnitCost(p.getCost());
            item.setQuantity(line.quantity());
            item.setNote(trim(line.note()));
            round.addItem(item);
        }
        return round;
    }

    private void discountStock(Round round, Tab tab, Long userId) {
        Map<Long, Product> byId = products.findAllById(round.getItems().stream().map(RoundItem::getProductId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        for (RoundItem i : round.getItems()) {
            if (i.isVoided()) continue;
            Product p = byId.get(i.getProductId());
            if (p == null) continue;
            if (i.getUnitCost() == null) i.setUnitCost(p.getCost());
            inventory.move(p, MovementType.SALE, -i.getQuantity(), p.getCost(), null, "Cuenta #" + tab.getId(), null, userId, tab.getId());
        }
    }

    private void resolveCalls(Long tableId, Long userId) {
        for (ServiceCall c : calls.findByTableIdAndStatus(tableId, CallStatus.OPEN)) {
            c.setStatus(CallStatus.DONE);
            c.setDoneAt(Instant.now());
            c.setDoneBy(userId);
        }
    }

    private Round ownedRound(Long venueId, Long roundId) {
        Round r = rounds.findById(roundId).orElseThrow(() -> ApiException.notFound("Ronda no encontrada"));
        ownedTab(venueId, r.getTabId());
        return r;
    }

    private OrderDtos.RoundView roundView(Round r, String tableName, Map<Long, String> names) {
        return new OrderDtos.RoundView(r.getId(), r.getTabId(), tableName, r.getSource(), r.getStatus(), r.getClientName(),
                r.getNote(), r.getRejectReason(), names.get(r.getCreatedBy()), r.getAssignedTo(), names.get(r.getAssignedTo()),
                r.getCreatedAt(), r.getConfirmedAt(), r.getDeliveredAt(), r.total(), r.getPaymentId() != null, r.getPaymentId(),
                r.getItems().stream().map(OrderDtos.ItemView::of).toList());
    }

    private OrderDtos.PublicTab publicTab(BarTable table, Tab tab) {
        List<CallType> open = calls.findByTableIdAndStatus(table.getId(), CallStatus.OPEN).stream().map(ServiceCall::getType).toList();
        if (tab == null) {
            return new OrderDtos.PublicTab(table.getName(), false, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, List.of(), open);
        }
        List<Round> rs = rounds.findByTabIdOrderByCreatedAtAsc(tab.getId());
        return new OrderDtos.PublicTab(table.getName(), true, consumed(rs), due(rs), pendingTotal(rs),
                rs.stream().map(r -> new OrderDtos.PublicRound(r.getId(), r.getStatus(), r.getSource(), r.getCreatedAt(),
                        r.getRejectReason(), r.total(), r.getPaymentId() != null,
                        r.getItems().stream().map(OrderDtos.ItemView::of).toList())).toList(), open);
    }

    static BigDecimal consumed(List<Round> rs) {
        return rs.stream().filter(r -> r.getStatus().counts()).map(Round::total).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    static BigDecimal due(List<Round> rs) {
        return rs.stream().filter(Round::payable).map(Round::total).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    static BigDecimal pendingTotal(List<Round> rs) {
        return rs.stream().filter(r -> r.getStatus() == RoundStatus.PENDING).map(Round::total).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    static int itemCount(List<Round> rs) {
        return rs.stream().filter(r -> r.getStatus().counts()).flatMap(r -> r.getItems().stream())
                .filter(i -> !i.isVoided()).mapToInt(RoundItem::getQuantity).sum();
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
