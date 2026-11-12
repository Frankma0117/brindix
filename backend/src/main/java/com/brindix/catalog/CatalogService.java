package com.brindix.catalog;

import com.brindix.audit.AuditService;
import com.brindix.common.ApiException;
import com.brindix.inventory.InventoryService;
import com.brindix.inventory.MovementType;
import com.brindix.security.StaffPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CatalogService {

    private final CategoryRepository categories;
    private final ProductRepository products;
    private final InventoryService inventory;
    private final AuditService audit;

    public CatalogService(CategoryRepository categories, ProductRepository products, InventoryService inventory, AuditService audit) {
        this.categories = categories;
        this.products = products;
        this.inventory = inventory;
        this.audit = audit;
    }

    // ---------- Carta (cliente y mesero) ----------

    /** withStock = el mesero ve existencias; el cliente no. */
    @Transactional(readOnly = true)
    public List<CatalogDtos.MenuCategory> menu(Long venueId, boolean withStock) {
        List<Product> all = products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(venueId);
        Map<Long, List<Product>> byCategory = all.stream().filter(Product::isAvailable)
                .collect(Collectors.groupingBy(Product::getCategoryId, LinkedHashMap::new, Collectors.toList()));
        List<CatalogDtos.MenuCategory> out = new ArrayList<>();
        for (Category c : categories.findByVenueIdOrderBySortOrderAscNameAsc(venueId)) {
            List<Product> list = byCategory.getOrDefault(c.getId(), List.of());
            if (!c.isActive() || list.isEmpty()) continue;
            out.add(new CatalogDtos.MenuCategory(c.getId(), c.getName(), c.getIcon(), c.getArt(),
                    list.stream().map(p -> new CatalogDtos.MenuProduct(p.getId(), p.getCategoryId(), p.getName(),
                            p.getDescription(), p.getPrice(), p.getImageUrl(), c.getArt(), p.isFeatured(), p.soldOut(),
                            splitTags(p.getTags()), p.isTrackStock(), withStock ? p.getStock() : null, p.getUnit())).toList()));
        }
        return out;
    }

    // ---------- Categorías ----------

    @Transactional(readOnly = true)
    public List<CatalogDtos.CategoryView> listCategories(Long venueId) {
        return categories.findByVenueIdOrderBySortOrderAscNameAsc(venueId).stream()
                .map(c -> CatalogDtos.CategoryView.of(c, products.countByCategoryIdAndArchivedFalse(c.getId())))
                .toList();
    }

    @Transactional
    public CatalogDtos.CategoryView saveCategory(Long venueId, Long id, CatalogDtos.CategoryInput in) {
        Category c = id == null ? new Category() : ownedCategory(venueId, id);
        if (id == null) {
            c.setSortOrder(categories.findByVenueIdOrderBySortOrderAscNameAsc(venueId).stream().mapToInt(Category::getSortOrder).max().orElse(0) + 1);
        }
        c.setVenueId(venueId);
        c.setName(in.name().trim());
        c.setIcon(blank(in.icon()));
        c.setArt(blank(in.art()));
        c.setActive(in.active());
        c = categories.save(c);
        return CatalogDtos.CategoryView.of(c, id == null ? 0 : products.countByCategoryIdAndArchivedFalse(c.getId()));
    }

    @Transactional
    public void deleteCategory(Long venueId, Long id) {
        Category c = ownedCategory(venueId, id);
        if (products.countByCategoryIdAndArchivedFalse(id) > 0) {
            throw ApiException.conflict("La categoría tiene productos. Muévelos o quítalos primero.");
        }
        categories.delete(c);
    }

    @Transactional
    public void reorderCategories(Long venueId, List<Long> ids) {
        Map<Long, Category> mine = categories.findByVenueIdOrderBySortOrderAscNameAsc(venueId).stream()
                .collect(Collectors.toMap(Category::getId, Function.identity()));
        int i = 1;
        for (Long id : ids) {
            Category c = mine.get(id);
            if (c != null) c.setSortOrder(i++);
        }
    }

    // ---------- Productos ----------

    @Transactional(readOnly = true)
    public List<CatalogDtos.ProductView> listProducts(Long venueId) {
        List<Category> cats = categories.findByVenueIdOrderBySortOrderAscNameAsc(venueId);
        Map<Long, Category> byId = cats.stream().collect(Collectors.toMap(Category::getId, Function.identity()));
        Map<Long, Integer> rank = new HashMap<>();
        for (int i = 0; i < cats.size(); i++) rank.put(cats.get(i).getId(), i);
        return products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(venueId).stream()
                .sorted(Comparator.comparing((Product p) -> rank.getOrDefault(p.getCategoryId(), 999)))
                .map(p -> view(p, byId.get(p.getCategoryId())))
                .toList();
    }

    @Transactional
    public CatalogDtos.ProductView saveProduct(StaffPrincipal me, Long id, CatalogDtos.ProductInput in) {
        Category c = ownedCategory(me.venueId(), in.categoryId());
        boolean isNew = id == null;
        Product p = isNew ? new Product() : ownedProduct(me.venueId(), id);
        BigDecimal oldPrice = p.getPrice(), oldCost = p.getCost();
        if (isNew || !c.getId().equals(p.getCategoryId())) p.setSortOrder(nextOrder(me.venueId(), c.getId()));
        p.setVenueId(me.venueId());
        p.setCategoryId(c.getId());
        p.setName(in.name().trim());
        p.setDescription(blank(in.description()));
        p.setPrice(in.price());
        p.setCost(in.cost());
        p.setImageUrl(blank(in.imageUrl()));
        p.setUnit(in.unit() == null || in.unit().isBlank() ? "und" : in.unit().trim());
        p.setTrackStock(in.trackStock());
        p.setMinStock(in.minStock());
        p.setAvailable(in.available());
        p.setFeatured(in.featured());
        p.setTags(blank(in.tags()));
        p = products.save(p);
        if (isNew) {
            audit.log(me, me.venueId(), "Creó producto", "product", p.getId(), p.getName() + " · venta " + p.getPrice() + " · costo " + p.getCost());
            if (in.trackStock() && in.initialStock() != null && in.initialStock() > 0) {
                inventory.move(p, MovementType.ADJUSTMENT, in.initialStock(), in.cost(), null, null, "Existencias iniciales", me.id(), null);
            }
        } else if (oldPrice.compareTo(p.getPrice()) != 0 || !Objects.equals(oldCost, p.getCost())) {
            audit.log(me, me.venueId(), "Cambió precio/costo", "product", p.getId(),
                    p.getName() + ": venta " + oldPrice + " → " + p.getPrice() + " · costo " + oldCost + " → " + p.getCost());
        }
        return view(p, c);
    }

    @Transactional
    public CatalogDtos.ProductView patch(StaffPrincipal me, Long id, CatalogDtos.ProductPatch in) {
        Product p = ownedProduct(me.venueId(), id);
        BigDecimal oldPrice = p.getPrice(), oldCost = p.getCost();
        if (in.price() != null) p.setPrice(in.price());
        if (in.cost() != null) p.setCost(in.cost());
        if (in.imageUrl() != null && !in.imageUrl().isBlank()) p.setImageUrl(in.imageUrl().trim());
        if (Boolean.TRUE.equals(in.clearImage())) p.setImageUrl(null);
        if (in.available() != null) p.setAvailable(in.available());
        if (in.featured() != null) p.setFeatured(in.featured());
        if (in.price() != null || in.cost() != null) {
            if (oldPrice.compareTo(p.getPrice()) != 0 || !Objects.equals(oldCost, p.getCost())) {
                audit.log(me, me.venueId(), "Cambió precio/costo", "product", p.getId(),
                        p.getName() + ": venta " + oldPrice + " → " + p.getPrice() + " · costo " + oldCost + " → " + p.getCost());
            }
        }
        return view(p, categories.findById(p.getCategoryId()).orElse(null));
    }

    /** Orden dentro de una categoría; si un producto viene de otra categoría, se mueve. */
    @Transactional
    public void reorderProducts(Long venueId, Long categoryId, List<Long> ids) {
        ownedCategory(venueId, categoryId);
        Map<Long, Product> mine = products.findAllById(ids).stream().filter(p -> p.getVenueId().equals(venueId))
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        int i = 1;
        for (Long id : ids) {
            Product p = mine.get(id);
            if (p == null) continue;
            p.setCategoryId(categoryId);
            p.setSortOrder(i++);
        }
    }

    /** No se borra: queda archivado para que el historial de cuentas siga intacto. */
    @Transactional
    public void archiveProduct(StaffPrincipal me, Long id) {
        Product p = ownedProduct(me.venueId(), id);
        p.setArchived(true);
        p.setAvailable(false);
        audit.log(me, me.venueId(), "Quitó producto de la carta", "product", p.getId(), p.getName());
    }

    @Transactional(readOnly = true)
    public Product ownedProduct(Long venueId, Long id) {
        return products.findById(id).filter(p -> p.getVenueId().equals(venueId) && !p.isArchived())
                .orElseThrow(() -> ApiException.notFound("Producto no encontrado"));
    }

    private int nextOrder(Long venueId, Long categoryId) {
        return products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(venueId).stream()
                .filter(x -> x.getCategoryId().equals(categoryId)).mapToInt(Product::getSortOrder).max().orElse(0) + 1;
    }

    private Category ownedCategory(Long venueId, Long id) {
        return categories.findById(id).filter(c -> c.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Categoría no encontrada"));
    }

    static CatalogDtos.ProductView view(Product p, Category c) {
        BigDecimal profit = p.getCost() == null ? null : p.getPrice().subtract(p.getCost());
        BigDecimal pct = profit == null || p.getPrice().signum() == 0 ? null
                : profit.multiply(BigDecimal.valueOf(100)).divide(p.getPrice(), 1, RoundingMode.HALF_UP);
        return new CatalogDtos.ProductView(p.getId(), p.getCategoryId(), c == null ? null : c.getName(), p.getName(),
                p.getDescription(), p.getPrice(), p.getCost(), profit, pct, p.getImageUrl(), c == null ? null : c.getArt(), p.getUnit(),
                p.isTrackStock(), p.getStock(), p.getMinStock(), p.isAvailable(), p.isFeatured(), p.getTags(),
                p.getSortOrder(), p.soldOut(), p.lowStock());
    }

    private static List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) return List.of();
        return Arrays.stream(tags.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
