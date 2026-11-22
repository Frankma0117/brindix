package com.brindix.ai;

import java.text.Normalizer;
import java.util.*;

/** Empareja la descripción de una línea de factura con productos/insumos del bar por similitud de nombre (función pura). */
public final class InvoiceMatcher {

    public record Candidate(String kind, Long id, String name) {}

    public record Match(String kind, Long id, String name, double score) {}

    private static final double MIN_SCORE = 0.5;
    private static final Set<String> STOP = Set.of("de", "del", "la", "el", "los", "las", "x", "con", "en", "y", "por", "un", "una");

    private InvoiceMatcher() {}

    public static String normalize(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
        return n.replaceAll("[^a-z0-9 ]+", " ").replaceAll("\\s+", " ").trim();
    }

    static Set<String> tokens(String s) {
        Set<String> out = new LinkedHashSet<>();
        for (String t : normalize(s).split(" ")) if (!t.isEmpty() && !STOP.contains(t)) out.add(t);
        return out;
    }

    public static double score(String a, String b) {
        String na = normalize(a), nb = normalize(b);
        if (na.isEmpty() || nb.isEmpty()) return 0;
        if (na.equals(nb)) return 1;
        Set<String> ta = tokens(a), tb = tokens(b);
        if (ta.isEmpty() || tb.isEmpty()) return 0;
        int common = 0;
        for (String x : ta) {
            for (String y : tb) {
                if (x.equals(y) || (x.length() >= 4 && y.length() >= 4 && (x.startsWith(y) || y.startsWith(x)))) { common++; break; }
            }
        }
        double jaccard = (double) common / (ta.size() + tb.size() - common);
        double cover = (double) common / Math.min(ta.size(), tb.size());
        double s = Math.max(jaccard, cover * 0.8);
        if (na.contains(nb) || nb.contains(na)) s = Math.max(s, 0.75);
        return Math.min(1, s);
    }

    /** Mejor candidato con puntaje mínimo, o null. Ante empate gana el primero. */
    public static Match best(String description, List<Candidate> candidates) {
        Match best = null;
        for (Candidate c : candidates) {
            double sc = score(description, c.name());
            if (sc >= MIN_SCORE && (best == null || sc > best.score())) {
                best = new Match(c.kind(), c.id(), c.name(), Math.round(sc * 100) / 100.0);
            }
        }
        return best;
    }
}
