package com.brindix.notifications;

import com.brindix.cash.CashShift;
import com.brindix.cash.CashShiftRepository;
import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.staff.Role;
import com.brindix.staff.StaffUserRepository;
import com.brindix.tables.BarTableRepository;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Lista «Por configurar»: lo que falta en el módulo administrador, calculado en el momento. */
@Service
public class SetupChecklistService {

    public record Item(String key, String title, String hint, String link, boolean done) {}

    private final ProductRepository products;
    private final BarTableRepository tables;
    private final StaffUserRepository users;
    private final VenueService venues;
    private final CashShiftRepository shifts;

    public SetupChecklistService(ProductRepository products, BarTableRepository tables, StaffUserRepository users,
                                 VenueService venues, CashShiftRepository shifts) {
        this.products = products;
        this.tables = tables;
        this.users = users;
        this.venues = venues;
        this.shifts = shifts;
    }

    @Transactional(readOnly = true)
    public List<Item> checklist(Long venueId) {
        List<Product> prods = products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(venueId);
        List<Product> tracked = prods.stream().filter(Product::isTrackStock).toList();
        Venue v = venues.get(venueId);
        boolean music = (v.getMusicProvider() == Venue.MusicProvider.SPOTIFY && v.getSpotifyRefreshToken() != null)
                || (v.getMusicProvider() == Venue.MusicProvider.YOUTUBE && v.getYoutubeApiKey() != null && !v.getYoutubeApiKey().isBlank());

        List<Item> out = new ArrayList<>();
        out.add(new Item("products", "Carga productos con precio", "Sin carta no hay nada que pedir.", "carta",
                prods.stream().anyMatch(p -> p.getPrice() != null && p.getPrice().signum() > 0)));
        out.add(new Item("tables", "Crea tus mesas y códigos QR", "Cada mesa tiene su QR para ver la carta.", "mesas",
                tables.findByVenueIdOrderBySortOrderAscNameAsc(venueId).stream().anyMatch(t -> !t.isArchived())));
        out.add(new Item("email", "Define el correo del administrador", "Sirve para recuperar la clave y recibir avisos.", "equipo",
                users.findByVenueIdAndRoleOrderByIdAsc(venueId, Role.ADMIN).stream()
                        .anyMatch(a -> a.getEmail() != null && !a.getEmail().isBlank())));
        out.add(new Item("music", "Conecta la música", "Spotify o YouTube, en Configuración.", "configuracion", music));
        out.add(new Item("costs", "Carga el costo de tus productos", "Con costo se calcula la ganancia real.", "inventario",
                !tracked.isEmpty() && tracked.stream().allMatch(p -> p.getCost() != null)));
        out.add(new Item("first-close", "Cierra tu primer turno de caja", "Así compruebas que el efectivo cuadra.", "caja",
                shifts.findTop60ByVenueIdOrderByOpenedAtDesc(venueId).stream().anyMatch(s -> s.getStatus() == CashShift.Status.CLOSED)));
        return out;
    }
}
