package com.brindix.inventory;

public enum MovementType {
    /** Entrada de mercancia (compra a proveedor). */
    ENTRY,
    /** Venta: sale al confirmar una ronda. */
    SALE,
    /** Devolucion al inventario: ronda rechazada o producto anulado. */
    RETURN,
    /** Conteo fisico: deja el stock en lo que se conto. */
    ADJUSTMENT,
    /** Merma: roto, vencido, cortesia, consumo interno. */
    WASTE
}
