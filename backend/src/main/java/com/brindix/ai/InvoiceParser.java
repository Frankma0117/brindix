package com.brindix.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** Convierte, de forma defensiva, el texto que devuelve el modelo de visión en una factura estructurada. */
public final class InvoiceParser {

    public record Line(String descripcion, BigDecimal cantidad, String unidad, BigDecimal costoUnitario, BigDecimal costoTotal) {}

    public record Invoice(String proveedor, String numero, String fecha, BigDecimal total, List<Line> lineas) {}

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private InvoiceParser() {}

    /** Devuelve null si no hay un JSON utilizable. */
    public static Invoice parse(String raw) {
        if (raw == null) return null;
        int a = raw.indexOf('{'), b = raw.lastIndexOf('}');
        if (a < 0 || b <= a) return null;
        JsonNode root;
        try {
            root = MAPPER.readTree(raw.substring(a, b + 1));
        } catch (Exception e) {
            return null;
        }
        if (root == null || !root.isObject()) return null;
        List<Line> lines = new ArrayList<>();
        JsonNode arr = root.has("lineas") ? root.get("lineas") : root.get("lines");
        if (arr != null && arr.isArray()) {
            for (JsonNode n : arr) {
                String d = text(n, "descripcion");
                if (d == null) continue;
                BigDecimal qty = num(n.get("cantidad"));
                BigDecimal unit = num(n.get("costoUnitario"));
                BigDecimal tot = num(n.get("costoTotal"));
                if (unit == null && tot != null && qty != null && qty.signum() > 0) unit = tot.divide(qty, 2, java.math.RoundingMode.HALF_UP);
                if (tot == null && unit != null && qty != null) tot = unit.multiply(qty);
                lines.add(new Line(d, qty, text(n, "unidad"), unit, tot));
            }
        }
        return new Invoice(text(root, "proveedor"), text(root, "numero"), text(root, "fecha"), num(root.get("total")), lines);
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) return null;
        String s = v.asText("").trim();
        return s.isEmpty() ? null : s;
    }

    /** Acepta números JSON o texto: "12.500", "12,5", "$ 1.234,50", "1,234.50". */
    static BigDecimal num(JsonNode v) {
        if (v == null || v.isNull()) return null;
        if (v.isNumber()) return v.decimalValue();
        String s = v.asText("").replaceAll("[^0-9,.\\-]", "");
        if (s.isEmpty() || s.equals("-")) return null;
        int c = s.lastIndexOf(','), d = s.lastIndexOf('.');
        if (c >= 0 && d >= 0) {
            // el último separador es el decimal
            if (c > d) s = s.replace(".", "").replace(',', '.');
            else s = s.replace(",", "");
        } else if (c >= 0) {
            s = isThousands(s, c, ',') ? s.replace(",", "") : s.replace(',', '.');
        } else if (d >= 0) {
            if (isThousands(s, d, '.')) s = s.replace(".", "");
        }
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** "12.500" o "1.234.567" son miles; "12.5" o "0,75" son decimales. */
    private static boolean isThousands(String s, int lastIdx, char sep) {
        long count = s.chars().filter(ch -> ch == sep).count();
        if (count > 1) return true;
        return s.length() - lastIdx - 1 == 3 && lastIdx > 0 && !s.startsWith("0");
    }
}
