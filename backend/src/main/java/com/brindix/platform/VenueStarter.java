package com.brindix.platform;

import com.brindix.banners.Banner;
import com.brindix.banners.BannerRepository;
import com.brindix.catalog.Category;
import com.brindix.catalog.CategoryRepository;
import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.common.Codes;
import com.brindix.inventory.InventoryService;
import com.brindix.inventory.MovementType;
import com.brindix.staff.Role;
import com.brindix.staff.StaffService;
import com.brindix.staff.StaffUser;
import com.brindix.tables.BarTable;
import com.brindix.tables.BarTableRepository;
import com.brindix.tables.TableService;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/** Crea un bar listo para usar: su administrador y, si se pide, mesas, carta de ejemplo y banners. */
@Service
public class VenueStarter {

    private final VenueRepository venues;
    private final StaffService staff;
    private final CategoryRepository categories;
    private final ProductRepository products;
    private final BarTableRepository tables;
    private final BannerRepository banners;
    private final TableService tableService;
    private final InventoryService inventory;

    public VenueStarter(VenueRepository venues, StaffService staff, CategoryRepository categories, ProductRepository products,
                        BarTableRepository tables, BannerRepository banners, TableService tableService, InventoryService inventory) {
        this.venues = venues;
        this.staff = staff;
        this.categories = categories;
        this.products = products;
        this.tables = tables;
        this.banners = banners;
        this.tableService = tableService;
        this.inventory = inventory;
    }

    @Transactional
    public Venue create(String name, String slug, String adminName, String adminUsername, String adminPassword, boolean sample) {
        Venue v = new Venue();
        v.setName(name);
        v.setSlug(slug);
        v.setTagline("Buena música, mejores tragos");
        v.setScreenKey(Codes.random(20));
        v = venues.save(v);
        StaffUser admin = staff.newUser(v.getId(), adminName, adminUsername, adminPassword, Role.ADMIN);
        int order = 0;
        for (int i = 1; i <= 8; i++) table(v.getId(), "Mesa " + i, "Salón", 4, ++order);
        if (sample) sampleMenu(v, admin);
        return v;
    }

    private void sampleMenu(Venue v, StaffUser admin) {
        Long vid = v.getId();
        Category beer = category(vid, "Cervezas", "🍺", "beer", 1);
        Category cocktail = category(vid, "Cócteles", "🍸", "cocktail", 2);
        Category spirit = category(vid, "Licores", "🥃", "spirit", 3);
        Category shot = category(vid, "Shots", "🔥", "shot", 4);
        Category soft = category(vid, "Sin alcohol", "🥤", "soft", 5);
        Category food = category(vid, "Para picar", "🍟", "food", 6);

        product(admin, beer, "Club Colombia Dorada", "Lager dorada, bien fría.", 8000, 3500, 48, 12, true, "nacional");
        product(admin, beer, "Águila", "La de siempre, en botella.", 6500, 2800, 48, 12, false, "nacional");
        product(admin, beer, "Corona", "Con su limón, como debe ser.", 12000, 5500, 24, 6, true, "importada");
        product(admin, beer, "Stella Artois", "Lager belga de sabor limpio.", 12000, 5800, 24, 6, false, "importada");
        product(admin, beer, "Michelada", "Tu cerveza con limón, sal y el toque de la casa.", 11000, 4200, null, 0, false, "preparada");

        product(admin, cocktail, "Mojito", "Ron blanco, hierbabuena fresca, limón y soda.", 22000, 7000, null, 0, true, "clásico,refrescante");
        product(admin, cocktail, "Margarita", "Tequila, triple sec y limón con borde de sal.", 24000, 8000, null, 0, false, "clásico");
        product(admin, cocktail, "Piña Colada", "Ron, crema de coco y piña. Cremosa y tropical.", 24000, 7500, null, 0, false, "dulce");
        product(admin, cocktail, "Gin Tonic", "Ginebra, tónica premium, pepino y pimienta rosa.", 26000, 9000, null, 0, true, "premium");
        product(admin, cocktail, "Aperol Spritz", "Aperol, prosecco y un chorrito de soda.", 28000, 10000, null, 0, false, "burbujas");

        product(admin, spirit, "Aguardiente Antioqueño (media)", "Media botella, sin azúcar.", 55000, 32000, 12, 3, false, "botella");
        product(admin, spirit, "Aguardiente Antioqueño (botella)", "Botella de 750 ml.", 95000, 58000, 10, 3, true, "botella");
        product(admin, spirit, "Ron Viejo de Caldas (botella)", "Tradicional 3 años, 750 ml.", 110000, 65000, 8, 2, false, "botella");
        product(admin, spirit, "Whisky Old Parr 12 (botella)", "Whisky escocés de 12 años.", 220000, 140000, 6, 2, false, "botella,premium");

        product(admin, shot, "Shot de tequila", "Con sal y limón.", 10000, 3500, null, 0, false, "");
        product(admin, shot, "Shot de aguardiente", "El de la casa.", 6000, 2000, null, 0, false, "");
        product(admin, shot, "Jägerbomb", "Jägermeister dentro de energizante.", 18000, 7000, null, 0, true, "fiesta");

        product(admin, soft, "Agua", "Botella 600 ml.", 4000, 1500, 36, 10, false, "");
        product(admin, soft, "Gaseosa", "Coca-Cola, Sprite o Quatro.", 5000, 2200, 36, 10, false, "");
        product(admin, soft, "Red Bull", "Lata 250 ml.", 10000, 5200, 24, 6, false, "energizante");
        product(admin, soft, "Limonada de coco", "Cremosa y bien fría.", 12000, 3500, null, 0, true, "sin alcohol");

        product(admin, food, "Picada de la casa", "Chorizo, chicharrón, papa criolla, arepa y guacamole. Para 3-4.", 48000, 22000, null, 0, true, "para compartir");
        product(admin, food, "Alitas BBQ x8", "Alitas glaseadas en salsa BBQ ahumada.", 32000, 13000, null, 0, false, "");
        product(admin, food, "Papas a la francesa", "Crocantes, con salsas de la casa.", 14000, 4500, null, 0, false, "");
        product(admin, food, "Nachos con queso", "Totopos, queso fundido, pico de gallo y jalapeños.", 24000, 8500, null, 0, false, "para compartir");

        for (int i = 1; i <= 3; i++) table(vid, "Terraza " + i, "Terraza", 6, 20 + i);
        for (int i = 1; i <= 2; i++) table(vid, "Barra " + i, "Barra", 2, 30 + i);

        banner(vid, "Happy Hour", "2x1 en cócteles de 6:00 a 8:00 p. m.", "neon", 1);
        banner(vid, "Tu canción, tu noche", "Escanea el QR de tu mesa y pide la que quieras escuchar.", "lime", 2);
        banner(vid, "Picada de la casa", "La favorita para compartir con el parche.", "amber", 3);
    }

    private Category category(Long vid, String name, String icon, String art, int order) {
        Category c = new Category();
        c.setVenueId(vid);
        c.setName(name);
        c.setIcon(icon);
        c.setArt(art);
        c.setSortOrder(order);
        return categories.save(c);
    }

    private int productOrder = 0;

    private void product(StaffUser admin, Category c, String name, String desc, int price, Integer cost,
                         Integer stock, int minStock, boolean featured, String tags) {
        Product p = new Product();
        p.setVenueId(c.getVenueId());
        p.setCategoryId(c.getId());
        p.setName(name);
        p.setDescription(desc);
        p.setPrice(BigDecimal.valueOf(price));
        p.setCost(cost == null ? null : BigDecimal.valueOf(cost));
        p.setTrackStock(stock != null);
        p.setMinStock(minStock);
        p.setFeatured(featured);
        p.setTags(tags == null || tags.isBlank() ? null : tags);
        p.setSortOrder(++productOrder);
        p = products.save(p);
        if (stock != null && stock > 0) {
            inventory.move(p, MovementType.ADJUSTMENT, stock, p.getCost(), null, null, "Existencias iniciales", admin.getId(), null);
        }
    }

    private void table(Long vid, String name, String zone, int seats, int order) {
        BarTable t = new BarTable();
        t.setVenueId(vid);
        t.setName(name);
        t.setZone(zone);
        t.setSeats(seats);
        t.setSortOrder(order);
        t.setCode(tableService.newCode());
        tables.save(t);
    }

    private void banner(Long vid, String title, String subtitle, String theme, int order) {
        Banner b = new Banner();
        b.setVenueId(vid);
        b.setTitle(title);
        b.setSubtitle(subtitle);
        b.setTheme(theme);
        b.setSortOrder(order);
        b.setDurationSeconds(9);
        banners.save(b);
    }
}
