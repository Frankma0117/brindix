package com.brindix.staff;

public enum Role {
    /** Dueño de la plataforma Brindix: crea y administra bares. */
    SUPERADMIN,
    /** Administrador del bar: carta, inventario, caja, cobros, música, equipo. También puede atender mesas. */
    ADMIN,
    /** Mesero: ve la carta, carga productos a las mesas, entrega y (si el bar lo permite) cobra. */
    WAITER
}
