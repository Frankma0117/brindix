package com.brindix.notifications;

import com.brindix.cash.CashShift;
import com.brindix.cash.CashShiftRepository;
import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.staff.StaffUserRepository;
import com.brindix.tables.BarTable;
import com.brindix.tables.BarTableRepository;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/** Avisos idempotentes por dedupe_key y lista «Por configurar» según los datos, con repositorios simulados. */
class NotificationTest {

    @Test
    void pushEsIdempotentePorDedupeKey() {
        List<Notification> store = new ArrayList<>();
        NotificationRepository repo = mock(NotificationRepository.class);
        when(repo.existsByVenueIdAndDedupeKey(anyLong(), any())).thenAnswer(i -> store.stream()
                .anyMatch(n -> n.getVenueId().equals(i.getArgument(0)) && n.getDedupeKey().equals(i.getArgument(1))));
        when(repo.saveAndFlush(any(Notification.class))).thenAnswer(i -> {
            store.add(i.getArgument(0));
            return i.getArgument(0);
        });
        NotificationService service = new NotificationService(repo);

        service.push(1L, "DEBT_OLD", "Pedro debe", "x", "fiados", "debt:5:2026-47");
        service.push(1L, "DEBT_OLD", "Pedro debe", "x", "fiados", "debt:5:2026-47");
        assertEquals(1, store.size());
        service.push(1L, "DEBT_OLD", "Pedro debe", "x", "fiados", "debt:5:2026-48");
        service.push(2L, "DEBT_OLD", "Pedro debe", "x", "fiados", "debt:5:2026-47");
        assertEquals(3, store.size());
    }

    @Test
    void pushNoLanzaSiFallaElRepositorio() {
        NotificationRepository repo = mock(NotificationRepository.class);
        when(repo.existsByVenueIdAndDedupeKey(anyLong(), any())).thenThrow(new RuntimeException("db caída"));
        assertDoesNotThrow(() -> new NotificationService(repo).push(1L, "T", "t", null, null, "k"));
    }

    @Test
    void checklistMarcaDoneSegunLosDatos() {
        ProductRepository products = mock(ProductRepository.class);
        BarTableRepository tables = mock(BarTableRepository.class);
        CashShiftRepository shifts = mock(CashShiftRepository.class);
        VenueService venues = mock(VenueService.class);
        when(venues.get(1L)).thenReturn(new Venue());
        SetupChecklistService service = new SetupChecklistService(products, tables, mock(StaffUserRepository.class), venues, shifts);

        // Bar vacío: nada hecho
        assertTrue(service.checklist(1L).stream().noneMatch(SetupChecklistService.Item::done));

        Product p = new Product();
        p.setPrice(new BigDecimal("8000"));
        p.setCost(new BigDecimal("3000"));
        when(products.findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(1L)).thenReturn(List.of(p));
        when(tables.findByVenueIdOrderBySortOrderAscNameAsc(1L)).thenReturn(List.of(new BarTable()));
        CashShift closed = new CashShift();
        closed.setStatus(CashShift.Status.CLOSED);
        when(shifts.findTop60ByVenueIdOrderByOpenedAtDesc(1L)).thenReturn(List.of(closed));

        List<SetupChecklistService.Item> items = service.checklist(1L);
        for (String key : List.of("products", "tables", "costs", "first-close")) {
            assertTrue(items.stream().filter(i -> i.key().equals(key)).findFirst().orElseThrow().done(), key);
        }
        for (String key : List.of("email", "music")) {
            assertFalse(items.stream().filter(i -> i.key().equals(key)).findFirst().orElseThrow().done(), key);
        }
    }
}
