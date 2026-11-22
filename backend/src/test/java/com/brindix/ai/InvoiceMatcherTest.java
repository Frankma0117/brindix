package com.brindix.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class InvoiceMatcherTest {

    private final List<InvoiceMatcher.Candidate> cands = List.of(
            new InvoiceMatcher.Candidate("PRODUCT", 1L, "Cerveza Águila Light 330ml"),
            new InvoiceMatcher.Candidate("PRODUCT", 2L, "Aguardiente Antioqueño"),
            new InvoiceMatcher.Candidate("INGREDIENT", 7L, "Limón"),
            new InvoiceMatcher.Candidate("INGREDIENT", 8L, "Ron Medellín"));

    @Test
    void ignoraTildesYMayusculas() {
        var m = InvoiceMatcher.best("LIMON", cands);
        assertNotNull(m);
        assertEquals("INGREDIENT", m.kind());
        assertEquals(7L, m.id());
    }

    @Test
    void contieneYTokens() {
        var m = InvoiceMatcher.best("Cerveza Aguila Light x24", cands);
        assertNotNull(m);
        assertEquals(1L, m.id());
        assertEquals("PRODUCT", m.kind());
    }

    @Test
    void sinParecidoDevuelveNull() {
        assertNull(InvoiceMatcher.best("Servilletas blancas", cands));
        assertNull(InvoiceMatcher.best("", cands));
    }

    @Test
    void prefiereElMejorPuntaje() {
        var m = InvoiceMatcher.best("Ron Medellin 750ml", cands);
        assertNotNull(m);
        assertEquals(8L, m.id());
    }
}
