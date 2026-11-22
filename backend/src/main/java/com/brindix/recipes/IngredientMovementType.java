package com.brindix.recipes;

public enum IngredientMovementType {
    /** Compra de insumo. */
    ENTRY,
    /** Gasto por la venta de un producto con receta. */
    SALE,
    /** Conteo fisico: deja el stock en lo contado. */
    ADJUST,
    /** Merma: derrame, vencido, consumo interno. */
    WASTE,
    /** Devolucion por anulacion o cambio de cantidad de una venta. */
    SALE_VOID
}
