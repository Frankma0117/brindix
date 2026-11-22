package com.brindix.bar;

import com.brindix.orders.*;
import com.brindix.recipes.Ingredient;
import com.brindix.recipes.IngredientRepository;
import com.brindix.recipes.RecipeLine;
import com.brindix.recipes.RecipeLineRepository;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.Role;
import com.brindix.tables.BarTable;
import com.brindix.tables.BarTableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Cola de barra: solo ítems que se preparan y siguen pendientes; marcar listo y deshacer; aislamiento por bar. */
class BarQueueTest {

    private final StaffPrincipal bartender = new StaffPrincipal(5L, 1L, "barra", "Barra", Role.BARTENDER, false);
    private BarService service;
    private RoundItem coctel;
    private RoundItem cerveza;

    @BeforeEach
    void setUp() {
        RoundRepository rounds = mock(RoundRepository.class);
        RoundItemRepository items = mock(RoundItemRepository.class);
        TabRepository tabs = mock(TabRepository.class);
        BarTableRepository tables = mock(BarTableRepository.class);
        RecipeLineRepository lines = mock(RecipeLineRepository.class);
        IngredientRepository ingredients = mock(IngredientRepository.class);

        Round round = new Round();
        round.setId(10L);
        round.setTabId(20L);
        coctel = item(1L, 100L, "Mojito", PrepStatus.PENDING, round);
        cerveza = item(2L, 101L, "Cerveza", null, round);
        Tab tab = new Tab();
        tab.setId(20L);
        tab.setVenueId(1L);
        tab.setTableId(30L);
        BarTable table = new BarTable();
        table.setId(30L);
        table.setName("Mesa 4");
        when(rounds.findInProgress(1L)).thenReturn(List.of(round));
        when(tabs.findAllById(any())).thenReturn(List.of(tab));
        when(tabs.findById(20L)).thenReturn(Optional.of(tab));
        when(tables.findAllById(any())).thenReturn(List.of(table));
        when(items.findById(1L)).thenReturn(Optional.of(coctel));
        when(items.findById(2L)).thenReturn(Optional.of(cerveza));
        RecipeLine l = new RecipeLine();
        l.setProductId(100L);
        l.setIngredientId(7L);
        l.setQuantity(new BigDecimal("2"));
        Ingredient ron = new Ingredient();
        ron.setId(7L);
        ron.setName("Ron");
        ron.setUnit("shot");
        when(lines.findByProductId(anyLong())).thenReturn(List.of());
        when(lines.findByProductId(100L)).thenReturn(List.of(l));
        when(ingredients.findAllById(any())).thenReturn(List.of(ron));
        service = new BarService(rounds, items, tabs, tables, lines, ingredients);
    }

    private RoundItem item(Long id, Long productId, String name, PrepStatus st, Round r) {
        RoundItem i = new RoundItem();
        i.setId(id);
        i.setProductId(productId);
        i.setProductName(name);
        i.setQuantity(2);
        i.setPrepStatus(st);
        r.addItem(i);
        return i;
    }

    @Test
    void queueOnlyHasPendingPrepItemsWithRecipe() {
        BarDtos.Queue q = service.queue(1L);
        assertEquals(1, q.items().size());
        assertEquals("Mojito", q.items().get(0).productName());
        assertEquals("Mesa 4", q.items().get(0).tableName());
        assertEquals("Ron", q.items().get(0).recipe().get(0).ingredient());
    }

    @Test
    void readyRemovesFromQueueAndUndoBringsBack() {
        service.markReady(bartender, 1L);
        assertEquals(PrepStatus.READY, coctel.getPrepStatus());
        assertEquals(5L, coctel.getPreparedBy());
        assertTrue(service.queue(1L).items().isEmpty());
        service.undo(bartender, 1L);
        assertEquals(1, service.queue(1L).items().size());
    }

    @Test
    void cannotMarkNonPrepItemOrOtherVenue() {
        assertThrows(RuntimeException.class, () -> service.markReady(bartender, 2L));
        StaffPrincipal other = new StaffPrincipal(9L, 2L, "x", "X", Role.BARTENDER, false);
        assertThrows(RuntimeException.class, () -> service.markReady(other, 1L));
    }
}
