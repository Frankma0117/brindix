package com.brindix.recipes;

import com.brindix.audit.AuditService;
import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.common.ApiException;
import com.brindix.notifications.NotificationService;
import com.brindix.security.StaffPrincipal;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class IngredientService {

    private final IngredientRepository ingredients;
    private final IngredientMovementRepository movements;
    private final RecipeLineRepository lines;
    private final ProductRepository products;
    private final AuditService audit;
    private final NotificationService notifications;

    public IngredientService(IngredientRepository ingredients, IngredientMovementRepository movements,
                             RecipeLineRepository lines, ProductRepository products, AuditService audit,
                             NotificationService notifications) {
        this.ingredients = ingredients;
        this.movements = movements;
        this.lines = lines;
        this.products = products;
        this.audit = audit;
        this.notifications = notifications;
    }

    // ---------- Insumos ----------

    @Transactional(readOnly = true)
    public List<RecipeDtos.IngredientView> list(Long venueId) {
        return ingredients.findByVenueIdAndArchivedFalseOrderByNameAsc(venueId).stream().map(IngredientService::view).toList();
    }

    @Transactional
    public RecipeDtos.IngredientView create(StaffPrincipal me, RecipeDtos.IngredientInput in) {
        String name = in.name().trim();
        if (ingredients.existsByVenueIdAndNameIgnoreCase(me.venueId(), name)) {
            throw ApiException.conflict("Ya existe un insumo llamado \"" + name + "\"");
        }
        Ingredient i = new Ingredient();
        i.setVenueId(me.venueId());
        i.setName(name);
        i.setUnit(in.unit().trim());
        i.setMinStock(in.minStock());
        ingredients.save(i);
        audit.log(me, me.venueId(), "Creó insumo", "ingredient", i.getId(), name + " (" + i.getUnit() + ")");
        return view(i);
    }

    @Transactional
    public RecipeDtos.IngredientView update(StaffPrincipal me, Long id, RecipeDtos.IngredientInput in) {
        Ingredient i = owned(me.venueId(), id);
        i.setName(in.name().trim());
        i.setUnit(in.unit().trim());
        i.setMinStock(in.minStock());
        audit.log(me, me.venueId(), "Editó insumo", "ingredient", i.getId(), i.getName());
        return view(i);
    }

    @Transactional
    public void archive(StaffPrincipal me, Long id) {
        Ingredient i = owned(me.venueId(), id);
        i.setArchived(true);
        // se libera el nombre para poder crear otro igual
        i.setName(i.getName() + " (archivado " + i.getId() + ")");
        lines.deleteByIngredientId(id);
        audit.log(me, me.venueId(), "Archivó insumo", "ingredient", i.getId(), i.getName());
    }

    @Transactional
    public RecipeDtos.IngredientView addMovement(StaffPrincipal me, Long id, RecipeDtos.MovementInput in) {
        Ingredient i = owned(me.venueId(), id);
        BigDecimal q = in.quantity();
        switch (in.type()) {
            case ENTRY -> {
                if (q.signum() <= 0) throw ApiException.badRequest("Indica cuánto entra");
                BigDecimal unit = in.unitCost();
                if (unit == null && in.totalCost() != null) unit = in.totalCost().divide(q, 4, RoundingMode.HALF_UP);
                if (unit != null) i.setAvgCost(weightedCost(i, q, unit));
                move(i, IngredientMovementType.ENTRY, q, unit, in.note(), me.id(), null);
            }
            case ADJUST -> move(i, IngredientMovementType.ADJUST, q.subtract(i.getStock()), null, in.note(), me.id(), null);
            case WASTE -> {
                if (q.signum() <= 0) throw ApiException.badRequest("Indica cuánto se perdió");
                move(i, IngredientMovementType.WASTE, q.negate(), i.getAvgCost(), in.note(), me.id(), null);
            }
            default -> throw ApiException.badRequest("Tipo de movimiento no permitido");
        }
        audit.log(me, me.venueId(), "Movimiento de insumo", "ingredient", i.getId(),
                i.getName() + " " + in.type() + " " + q.stripTrailingZeros().toPlainString() + " " + i.getUnit());
        return view(i);
    }

    @Transactional(readOnly = true)
    public List<RecipeDtos.MovementView> history(Long venueId, Long id, int limit) {
        owned(venueId, id);
        return movements.findByIngredientIdOrderByCreatedAtDescIdDesc(id, PageRequest.of(0, Math.max(1, Math.min(500, limit))))
                .stream().map(m -> new RecipeDtos.MovementView(m.getId(), m.getType(), m.getQuantity(), m.getStockAfter(),
                        m.getUnitCost(), m.getNote(), m.getCreatedAt())).toList();
    }

    /** Promedio ponderado: (existencias × costo actual + entrada × costo nuevo) / total. */
    static BigDecimal weightedCost(Ingredient i, BigDecimal qty, BigDecimal unitCost) {
        BigDecimal current = i.getStock().max(BigDecimal.ZERO);
        if (current.signum() == 0 || i.getAvgCost() == null || i.getAvgCost().signum() == 0) return unitCost.setScale(4, RoundingMode.HALF_UP);
        BigDecimal total = i.getAvgCost().multiply(current).add(unitCost.multiply(qty));
        return total.divide(current.add(qty), 4, RoundingMode.HALF_UP);
    }

    private void move(Ingredient i, IngredientMovementType type, BigDecimal signedQty, BigDecimal unitCost, String note,
                      Long userId, Long tabId) {
        if (signedQty.signum() == 0) return;
        boolean wasOk = i.getMinStock() == null || i.getStock().compareTo(i.getMinStock()) > 0;
        i.setStock(i.getStock().add(signedQty));
        if (wasOk && i.lowStock()) {
            notifications.push(i.getVenueId(), "LOW_STOCK", i.getName() + " bajó del stock mínimo",
                    "Quedan " + i.getStock().stripTrailingZeros().toPlainString() + " " + i.getUnit()
                            + " (mínimo " + i.getMinStock().stripTrailingZeros().toPlainString() + ").", "insumos",
                    "low-ing:" + i.getId() + ":" + System.currentTimeMillis());
        }
        IngredientMovement m = new IngredientMovement();
        m.setVenueId(i.getVenueId());
        m.setIngredientId(i.getId());
        m.setType(type);
        m.setQuantity(signedQty);
        m.setStockAfter(i.getStock());
        m.setUnitCost(unitCost);
        m.setNote(note == null || note.isBlank() ? null : note.trim());
        m.setUserId(userId);
        m.setTabId(tabId);
        movements.save(m);
    }

    // ---------- Consumo por venta ----------

    /**
     * Gasta (units > 0, venta) o devuelve (units < 0, anulación) los insumos de la receta del producto.
     * El stock puede quedar negativo: nunca bloquea la venta.
     */
    @Transactional
    public void consumeForProduct(Long productId, int units, Long tabId, Long userId, String note) {
        if (units == 0) return;
        List<RecipeLine> recipe = lines.findByProductId(productId);
        if (recipe.isEmpty()) return;
        Map<Long, Ingredient> byId = ingredients.findAllById(recipe.stream().map(RecipeLine::getIngredientId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Ingredient::getId, Function.identity()));
        for (RecipeLine l : recipe) {
            Ingredient i = byId.get(l.getIngredientId());
            if (i == null) continue;
            BigDecimal amount = l.getQuantity().multiply(BigDecimal.valueOf(units));
            move(i, units > 0 ? IngredientMovementType.SALE : IngredientMovementType.SALE_VOID, amount.negate(),
                    i.getAvgCost(), note, userId, tabId);
        }
    }

    // ---------- Receta ----------

    @Transactional(readOnly = true)
    public RecipeDtos.RecipeView recipe(Long venueId, Long productId) {
        Product p = ownedProduct(venueId, productId);
        return buildView(p, lines.findByProductId(productId));
    }

    @Transactional
    public RecipeDtos.RecipeView saveRecipe(StaffPrincipal me, Long productId, RecipeDtos.RecipeInput in) {
        Product p = ownedProduct(me.venueId(), productId);
        Set<Long> seen = new HashSet<>();
        for (RecipeDtos.LineInput l : in.lines()) {
            if (!seen.add(l.ingredientId())) throw ApiException.badRequest("Un insumo está repetido en la receta");
            owned(me.venueId(), l.ingredientId());
        }
        lines.deleteByProductId(productId);
        lines.flush();
        List<RecipeLine> saved = new ArrayList<>();
        for (RecipeDtos.LineInput l : in.lines()) {
            RecipeLine rl = new RecipeLine();
            rl.setProductId(productId);
            rl.setIngredientId(l.ingredientId());
            rl.setQuantity(l.quantity());
            saved.add(lines.save(rl));
        }
        audit.log(me, me.venueId(), "Editó receta", "product", productId, p.getName() + ": " + saved.size() + " insumo(s)");
        return buildView(p, saved);
    }

    private RecipeDtos.RecipeView buildView(Product p, List<RecipeLine> recipe) {
        Map<Long, Ingredient> byId = ingredients.findAllById(recipe.stream().map(RecipeLine::getIngredientId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Ingredient::getId, Function.identity()));
        List<RecipeDtos.LineView> views = new ArrayList<>();
        BigDecimal cost = BigDecimal.ZERO;
        for (RecipeLine l : recipe) {
            Ingredient i = byId.get(l.getIngredientId());
            if (i == null) continue;
            BigDecimal lineCost = i.getAvgCost().multiply(l.getQuantity()).setScale(2, RoundingMode.HALF_UP);
            cost = cost.add(lineCost);
            views.add(new RecipeDtos.LineView(i.getId(), i.getName(), i.getUnit(), l.getQuantity(), i.getAvgCost(), lineCost));
        }
        views.sort(Comparator.comparing(RecipeDtos.LineView::name, String.CASE_INSENSITIVE_ORDER));
        BigDecimal margin = p.getPrice().subtract(cost);
        BigDecimal pct = p.getPrice().signum() > 0 ? margin.multiply(BigDecimal.valueOf(100)).divide(p.getPrice(), 1, RoundingMode.HALF_UP) : null;
        return new RecipeDtos.RecipeView(p.getId(), p.getPrice(), views, cost, margin, pct);
    }

    // ---------- util ----------

    private Ingredient owned(Long venueId, Long id) {
        Ingredient i = ingredients.findById(id).orElseThrow(() -> ApiException.notFound("Insumo no encontrado"));
        if (!i.getVenueId().equals(venueId) || i.isArchived()) throw ApiException.notFound("Insumo no encontrado");
        return i;
    }

    private Product ownedProduct(Long venueId, Long id) {
        Product p = products.findById(id).orElseThrow(() -> ApiException.notFound("Producto no encontrado"));
        if (!p.getVenueId().equals(venueId)) throw ApiException.notFound("Producto no encontrado");
        return p;
    }

    private static RecipeDtos.IngredientView view(Ingredient i) {
        return new RecipeDtos.IngredientView(i.getId(), i.getName(), i.getUnit(), i.getStock(), i.getMinStock(),
                i.getAvgCost(), i.lowStock());
    }
}
