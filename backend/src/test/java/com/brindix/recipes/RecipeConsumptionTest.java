package com.brindix.recipes;

import com.brindix.audit.AuditService;
import com.brindix.catalog.ProductRepository;
import com.brindix.notifications.NotificationService;
import com.brindix.security.StaffPrincipal;
import com.brindix.staff.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Recetas: consumo al vender, costo promedio, anulación y alerta de stock mínimo, con repositorios en memoria. */
class RecipeConsumptionTest {

    private final Map<Long, Ingredient> store = new HashMap<>();
    private final List<IngredientMovement> moves = new ArrayList<>();
    private final List<RecipeLine> recipe = new ArrayList<>();
    private final StaffPrincipal admin = new StaffPrincipal(1L, 1L, "admin", "Admin", Role.ADMIN, false);
    private NotificationService notifications;
    private IngredientService service;
    private Ingredient ron;
    private Ingredient jugo;

    @BeforeEach
    void setUp() {
        IngredientRepository ingredients = mock(IngredientRepository.class);
        when(ingredients.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(store.get(i.<Long>getArgument(0))));
        when(ingredients.findAllById(anyIterable())).thenAnswer(i -> {
            List<Ingredient> out = new ArrayList<>();
            for (Long id : i.<Iterable<Long>>getArgument(0)) if (store.containsKey(id)) out.add(store.get(id));
            return out;
        });
        IngredientMovementRepository movements = mock(IngredientMovementRepository.class);
        when(movements.save(any(IngredientMovement.class))).thenAnswer(i -> {
            moves.add(i.getArgument(0));
            return i.getArgument(0);
        });
        RecipeLineRepository lines = mock(RecipeLineRepository.class);
        when(lines.findByProductId(anyLong())).thenAnswer(i -> recipe.stream().filter(l -> l.getProductId().equals(i.getArgument(0))).toList());
        when(lines.findByProductIdIn(anyCollection())).thenAnswer(i -> {
            Collection<Long> ids = i.getArgument(0);
            return recipe.stream().filter(l -> ids.contains(l.getProductId())).toList();
        });

        notifications = mock(NotificationService.class);
        service = new IngredientService(ingredients, movements, lines, mock(ProductRepository.class), mock(AuditService.class), notifications);

        ron = ingredient(1L, "Ron", "shot", "20");
        jugo = ingredient(2L, "Jugo", "ml", "1000");
        line(1L, ron, "2");
        line(1L, jugo, "30");
    }

    private Ingredient ingredient(Long id, String name, String unit, String stock) {
        Ingredient i = new Ingredient();
        i.setId(id);
        i.setVenueId(1L);
        i.setName(name);
        i.setUnit(unit);
        i.setStock(new BigDecimal(stock));
        store.put(id, i);
        return i;
    }

    private void line(Long productId, Ingredient i, String qty) {
        RecipeLine l = new RecipeLine();
        l.setProductId(productId);
        l.setIngredientId(i.getId());
        l.setQuantity(new BigDecimal(qty));
        recipe.add(l);
    }

    private static void assertNum(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "esperado " + expected + " y fue " + actual);
    }

    @Test
    void ventaDescuentaInsumosPorCantidad() {
        service.consumeForProduct(1L, 3, 7L, 1L, "Cuenta #7");
        assertNum("14", ron.getStock());
        assertNum("910", jugo.getStock());
        assertEquals(2, moves.size());
        assertEquals(IngredientMovementType.SALE, moves.get(0).getType());
    }

    @Test
    void costoPorRecetaEsSumaDeInsumos() {
        ron.setAvgCost(new BigDecimal("1500"));
        jugo.setAvgCost(new BigDecimal("2.5"));
        Map<Long, BigDecimal> costs = service.recipeCosts(List.of(1L, 99L));
        assertNum("3075", costs.get(1L));          // 2 x 1500 + 30 x 2.5
        assertEquals(false, costs.containsKey(99L)); // sin receta: no aparece, se usa el costo del producto
    }

    @Test
    void insumoSinCostoCuentaCero() {
        ron.setAvgCost(new BigDecimal("1500"));
        assertNum("3000", service.recipeCosts(List.of(1L)).get(1L));
    }

    @Test
    void productoSinRecetaNoHaceNada() {
        service.consumeForProduct(99L, 5, 7L, 1L, null);
        assertEquals(0, moves.size());
    }

    @Test
    void ventaPuedeDejarStockNegativoSinFallar() {
        service.consumeForProduct(1L, 15, 7L, 1L, null);
        assertNum("-10", ron.getStock());
    }

    @Test
    void costoPromedioPonderadoEnEntradas() {
        ron.setAvgCost(new BigDecimal("1000"));
        // 20 en existencia a 1000; entran 20 con costo total 40000 (2000 c/u) -> promedio 1500
        service.addMovement(admin, 1L, new RecipeDtos.MovementInput(IngredientMovementType.ENTRY, new BigDecimal("20"),
                null, new BigDecimal("40000"), null));
        assertNum("40", ron.getStock());
        assertNum("1500", ron.getAvgCost());
    }

    @Test
    void anulacionRestituyeInsumos() {
        service.consumeForProduct(1L, 2, 7L, 1L, null);
        service.consumeForProduct(1L, -2, 7L, 1L, "Anulado");
        assertNum("20", ron.getStock());
        assertNum("1000", jugo.getStock());
        assertEquals(IngredientMovementType.SALE_VOID, moves.get(moves.size() - 1).getType());
    }

    @Test
    void cruzarElMinimoAvisaUnaSolaVez() {
        ron.setMinStock(new BigDecimal("10"));
        service.consumeForProduct(1L, 4, 7L, 1L, null);   // 20 -> 12
        verify(notifications, never()).push(anyLong(), anyString(), anyString(), anyString(), anyString(), anyString());
        service.consumeForProduct(1L, 3, 7L, 1L, null);   // 12 -> 6, cruza
        verify(notifications, times(1)).push(eq(1L), eq("LOW_STOCK"), anyString(), anyString(), eq("insumos"), anyString());
        service.consumeForProduct(1L, 1, 7L, 1L, null);   // 6 -> 4, ya estaba bajo
        verify(notifications, times(1)).push(anyLong(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void ajusteDejaElStockContado() {
        service.addMovement(admin, 2L, new RecipeDtos.MovementInput(IngredientMovementType.ADJUST, new BigDecimal("750"),
                null, null, "conteo"));
        assertNum("750", jugo.getStock());
        assertNum("-250", moves.get(0).getQuantity());
    }
}
