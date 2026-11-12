package com.brindix.orders;

/**
 * PENDING: pedido del cliente esperando que el administrador lo asigne a un mesero.
 * CONFIRMED: en camino (asignado a un mesero; ya descontó inventario).
 * DELIVERED: entregado en la mesa.
 * REJECTED: no se atendió.
 */
public enum RoundStatus {
    PENDING, CONFIRMED, DELIVERED, REJECTED;

    /** Solo lo confirmado o entregado suma a la cuenta. */
    public boolean counts() {
        return this == CONFIRMED || this == DELIVERED;
    }
}
