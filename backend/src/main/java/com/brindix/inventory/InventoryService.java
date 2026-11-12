package com.brindix.inventory;

import com.brindix.audit.AuditService;
import com.brindix.cash.CashMovement;
import com.brindix.cash.CashService;
import com.brindix.cash.CashShift;
import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.common.ApiException;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.StaffUser;
import com.brindix.staff.StaffUserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class InventoryService {

    private final StockMovementRepository movements;
    private final ProductRepository products;
    private final StaffUserRepository users;
    private final CashService cash;
    private final AuditService audit;

    public InventoryService(StockMovementRepository movements, ProductRepository products, StaffUserRepository users,
                            CashService cash, AuditService audit) {
        this.movements = movements;
        this.products = products;
        this.users = users;
        this.cash = cash;
        this.audit = audit;
    }

    /** Mueve el stock de un producto y deja la huella en el kardex. quantity va con signo. */
    @Transactional
    public void move(Product p, MovementType type, int quantity, BigDecimal unitCost, String supplier,
                     String reference, String note, Long userId, Long tabId) {
        if (!p.isTrackStock() || quantity == 0) return;
        p.setStock(p.getStock() + quantity);
        StockMovement m = new StockMovement();
        m.setVenueId(p.getVenueId());
        m.setProductId(p.getId());
        m.setType(type);
        m.setQuantity(quantity);
        m.setStockAfter(p.getStock());
        m.setUnitCost(unitCost);
        m.setSupplier(supplier);
        m.setReference(reference);
        m.setNote(note);
        m.setUserId(userId);
        m.setTabId(tabId);
        movements.save(m);
    }

    /**
     * Entrada de mercancía. El costo del producto queda como promedio ponderado:
     * (existencias × costo actual + unidades nuevas × costo nuevo) / total.
     */
    @Transactional
    public int registerEntry(StaffPrincipal me, InventoryDtos.EntryRequest in) {
        CashShift shift = in.paidFromCash() ? cash.requireOpen(me.venueId()) : null;
        Map<Long, Product> byId = loadOwned(me.venueId(), in.items().stream().map(InventoryDtos.EntryItem::productId).toList());
        BigDecimal invoice = BigDecimal.ZERO;
        for (InventoryDtos.EntryItem item : in.items()) {
            Product p = byId.get(item.productId());
            if (!p.isTrackStock()) {
                throw ApiException.badRequest("\"" + p.getName() + "\" no lleva inventario. Actívalo en el producto primero.");
            }
            if (item.unitCost() != null && item.unitCost().signum() > 0) {
                p.setCost(weightedCost(p, item.quantity(), item.unitCost()));
                invoice = invoice.add(item.unitCost().multiply(BigDecimal.valueOf(item.quantity())));
            }
            move(p, MovementType.ENTRY, item.quantity(), item.unitCost(), trim(in.supplier()), trim(in.reference()),
                    trim(in.note()), me.id(), null);
        }
        audit.log(me, me.venueId(), "Entrada de mercancía", "inventory", null,
                in.items().size() + " producto(s) · " + Objects.toString(trim(in.supplier()), "sin proveedor")
                        + " · " + Objects.toString(trim(in.reference()), "") + " · total " + invoice);
        if (shift != null && invoice.signum() > 0) {
            cash.record(me, shift, CashMovement.Direction.OUT, CashMovement.Category.RESTOCK, in.paymentMethod(), invoice,
                    "Mercancía " + Objects.toString(trim(in.supplier()), "") + " " + Objects.toString(trim(in.reference()), ""));
        }
        return in.items().size();
    }

    static BigDecimal weightedCost(Product p, int qty, BigDecimal unitCost) {
        int current = Math.max(0, p.getStock());
        if (p.getCost() == null || current == 0) return unitCost;
        BigDecimal total = p.getCost().multiply(BigDecimal.valueOf(current)).add(unitCost.multiply(BigDecimal.valueOf(qty)));
        return total.divide(BigDecimal.valueOf(current + qty), 2, RoundingMode.HALF_UP);
    }

    @Transactional
    public void adjust(StaffPrincipal me, InventoryDtos.AdjustRequest in) {
        Product p = loadOwned(me.venueId(), List.of(in.productId())).get(in.productId());
        if (!p.isTrackStock()) throw ApiException.badRequest("Ese producto no lleva inventario");
        int before = p.getStock();
        switch (in.type()) {
            case ADJUSTMENT -> {
                if (in.countedStock() == null || in.countedStock() < 0) throw ApiException.badRequest("Indica cuántas unidades contaste");
                move(p, MovementType.ADJUSTMENT, in.countedStock() - p.getStock(), null, null, null, trim(in.note()), me.id(), null);
            }
            case WASTE -> {
                if (in.quantity() == null || in.quantity() <= 0) throw ApiException.badRequest("Indica cuántas unidades se perdieron");
                move(p, MovementType.WASTE, -in.quantity(), p.getCost(), null, null, trim(in.note()), me.id(), null);
            }
            default -> throw ApiException.badRequest("Tipo de ajuste no permitido");
        }
        audit.log(me, me.venueId(), in.type() == MovementType.WASTE ? "Merma" : "Ajuste de inventario", "product", p.getId(),
                p.getName() + ": " + before + " → " + p.getStock() + (in.note() == null ? "" : " · " + in.note()));
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.MovementView> list(Long venueId, Long productId, MovementType type, Instant from, Instant to, int limit) {
        List<StockMovement> rows = movements.search(venueId, productId, type,
                from == null ? Instant.EPOCH : from, to == null ? Instant.now().plusSeconds(60) : to,
                PageRequest.of(0, Math.max(1, Math.min(1000, limit))));
        Map<Long, String> productNames = products.findAllById(rows.stream().map(StockMovement::getProductId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Product::getId, Product::getName));
        Map<Long, String> userNames = users.findAllById(rows.stream().map(StockMovement::getUserId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(StaffUser::getId, StaffUser::getName));
        return rows.stream().map(m -> new InventoryDtos.MovementView(m.getId(), m.getProductId(),
                productNames.getOrDefault(m.getProductId(), "?"), m.getType(), m.getQuantity(), m.getStockAfter(),
                m.getUnitCost(), m.getSupplier(), m.getReference(), m.getNote(),
                m.getUserId() == null ? null : userNames.get(m.getUserId()), m.getTabId(), m.getCreatedAt())).toList();
    }

    @Transactional(readOnly = true)
    public InventoryDtos.StockSummary summary(Long venueId) {
        List<Product> all = products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(venueId);
        int low = 0, out = 0, tracked = 0;
        BigDecimal value = BigDecimal.ZERO, sale = BigDecimal.ZERO;
        for (Product p : all) {
            if (!p.isTrackStock()) continue;
            tracked++;
            if (p.getStock() <= 0) out++;
            else if (p.lowStock()) low++;
            if (p.getStock() > 0) {
                if (p.getCost() != null) value = value.add(p.getCost().multiply(BigDecimal.valueOf(p.getStock())));
                sale = sale.add(p.getPrice().multiply(BigDecimal.valueOf(p.getStock())));
            }
        }
        return new InventoryDtos.StockSummary(tracked, low, out, value, sale);
    }

    private Map<Long, Product> loadOwned(Long venueId, Collection<Long> ids) {
        Map<Long, Product> byId = products.findAllById(new HashSet<>(ids)).stream()
                .filter(p -> p.getVenueId().equals(venueId) && !p.isArchived())
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        for (Long id : ids) {
            if (!byId.containsKey(id)) throw ApiException.notFound("Producto no encontrado: " + id);
        }
        return byId;
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
