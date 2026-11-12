package com.brindix.catalog;

import com.brindix.security.CurrentUser;
import com.brindix.venue.VenueService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class CatalogController {

    private final CatalogService service;
    private final VenueService venues;

    public CatalogController(CatalogService service, VenueService venues) {
        this.service = service;
        this.venues = venues;
    }

    /** Carta del cliente (QR). */
    @GetMapping("/api/public/{slug}/menu")
    public List<CatalogDtos.MenuCategory> menu(@PathVariable String slug) {
        return service.menu(venues.bySlug(slug).getId(), false);
    }

    /** Carta del mesero: igual que la del cliente pero con existencias. Solo lectura. */
    @GetMapping("/api/staff/menu")
    public List<CatalogDtos.MenuCategory> staffMenu() {
        return service.menu(CurrentUser.venueId(), true);
    }

    // ---------- Solo administrador ----------

    @GetMapping("/api/admin/categories")
    public List<CatalogDtos.CategoryView> categories() {
        return service.listCategories(CurrentUser.venueId());
    }

    @PostMapping("/api/admin/categories")
    public CatalogDtos.CategoryView createCategory(@Valid @RequestBody CatalogDtos.CategoryInput in) {
        return service.saveCategory(CurrentUser.venueId(), null, in);
    }

    @PutMapping("/api/admin/categories/{id}")
    public CatalogDtos.CategoryView updateCategory(@PathVariable Long id, @Valid @RequestBody CatalogDtos.CategoryInput in) {
        return service.saveCategory(CurrentUser.venueId(), id, in);
    }

    @DeleteMapping("/api/admin/categories/{id}")
    public void deleteCategory(@PathVariable Long id) {
        service.deleteCategory(CurrentUser.venueId(), id);
    }

    @PutMapping("/api/admin/categories/order")
    public void reorderCategories(@Valid @RequestBody CatalogDtos.Reorder in) {
        service.reorderCategories(CurrentUser.venueId(), in.ids());
    }

    @GetMapping("/api/admin/products")
    public List<CatalogDtos.ProductView> products() {
        return service.listProducts(CurrentUser.venueId());
    }

    @PostMapping("/api/admin/products")
    public CatalogDtos.ProductView createProduct(@Valid @RequestBody CatalogDtos.ProductInput in) {
        return service.saveProduct(CurrentUser.get(), null, in);
    }

    @PutMapping("/api/admin/products/{id}")
    public CatalogDtos.ProductView updateProduct(@PathVariable Long id, @Valid @RequestBody CatalogDtos.ProductInput in) {
        return service.saveProduct(CurrentUser.get(), id, in);
    }

    @PatchMapping("/api/admin/products/{id}")
    public CatalogDtos.ProductView patchProduct(@PathVariable Long id, @Valid @RequestBody CatalogDtos.ProductPatch in) {
        return service.patch(CurrentUser.get(), id, in);
    }

    @PutMapping("/api/admin/products/order")
    public void reorderProducts(@Valid @RequestBody CatalogDtos.ProductReorder in) {
        service.reorderProducts(CurrentUser.venueId(), in.categoryId(), in.ids());
    }

    @DeleteMapping("/api/admin/products/{id}")
    public void archiveProduct(@PathVariable Long id) {
        service.archiveProduct(CurrentUser.get(), id);
    }
}
