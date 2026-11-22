package com.brindix.ai;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class InvoiceParserTest {

    @Test
    void textoEnvueltoEnBloqueJson() {
        String raw = "Aquí está:\n```json\n{\"proveedor\":\"Bavaria\",\"numero\":\"FV-123\",\"fecha\":\"2026-11-20\",\"total\":120000,"
                + "\"lineas\":[{\"descripcion\":\"Cerveza Aguila\",\"cantidad\":24,\"unidad\":\"und\",\"costoUnitario\":2500,\"costoTotal\":60000}]}\n```";
        var inv = InvoiceParser.parse(raw);
        assertNotNull(inv);
        assertEquals("Bavaria", inv.proveedor());
        assertEquals("FV-123", inv.numero());
        assertEquals(1, inv.lineas().size());
        assertEquals(0, new BigDecimal("2500").compareTo(inv.lineas().get(0).costoUnitario()));
    }

    @Test
    void numerosConComaYPuntoDeMiles() {
        String raw = "{\"total\":\"$ 1.234.500\",\"lineas\":[{\"descripcion\":\"Limón\",\"cantidad\":\"2,5\",\"unidad\":\"kg\",\"costoTotal\":\"12.500,50\"}]}";
        var inv = InvoiceParser.parse(raw);
        assertNotNull(inv);
        assertEquals(0, new BigDecimal("1234500").compareTo(inv.total()));
        var l = inv.lineas().get(0);
        assertEquals(0, new BigDecimal("2.5").compareTo(l.cantidad()));
        assertEquals(0, new BigDecimal("12500.50").compareTo(l.costoTotal()));
        assertNotNull(l.costoUnitario()); // calculado = total / cantidad
        assertEquals(0, new BigDecimal("5000.20").compareTo(l.costoUnitario()));
    }

    @Test
    void camposFaltantesYLineasSinDescripcion() {
        var inv = InvoiceParser.parse("{\"lineas\":[{\"cantidad\":3},{\"descripcion\":\"Hielo\"}]}");
        assertNotNull(inv);
        assertNull(inv.proveedor());
        assertNull(inv.total());
        assertEquals(1, inv.lineas().size());
        assertNull(inv.lineas().get(0).cantidad());
    }

    @Test
    void basuraDevuelveNull() {
        assertNull(InvoiceParser.parse("no es json"));
        assertNull(InvoiceParser.parse("{ roto"));
        assertNull(InvoiceParser.parse(null));
    }
}
