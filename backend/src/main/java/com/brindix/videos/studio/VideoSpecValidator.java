package com.brindix.videos.studio;

import com.brindix.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.regex.Pattern;

/** Valida y normaliza el spec que manda el editor (contrato con taller/src/lib/spec.ts); lo desconocido se descarta. */
public final class VideoSpecValidator {

    public static final Pattern ASSET = Pattern.compile("^proyectos/brindix/[A-Za-z0-9_./-]+\\.(png|jpe?g|webp)$");
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final List<String> POSES = List.of("wave", "point", "celebrate", "idle", "none");
    private static final List<String> FORMATS = List.of("9x16", "16x9", "1x1");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private VideoSpecValidator() {}

    public static boolean validAsset(String path) {
        return path != null && ASSET.matcher(path).matches() && !path.contains("..");
    }

    private static String text(JsonNode n, int max, String field, boolean required) {
        String s = n == null || !n.isValueNode() || n.isNull() ? "" : n.asText("").trim();
        if (s.isEmpty() && required) throw ApiException.badRequest("Falta " + field + ".");
        if (s.length() > max) throw ApiException.badRequest(field + " es demasiado largo (máximo " + max + ").");
        return s;
    }

    private static Double num(JsonNode n, double min, double max, String field) {
        if (n == null || n.isMissingNode() || n.isNull() || (n.isTextual() && n.asText().isBlank())) return null;
        double v;
        try {
            v = n.isNumber() ? n.asDouble() : Double.parseDouble(n.asText().trim());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(field + " debe estar entre " + fmt(min) + " y " + fmt(max) + ".");
        }
        if (Double.isNaN(v) || Double.isInfinite(v) || v < min || v > max) {
            throw ApiException.badRequest(field + " debe estar entre " + fmt(min) + " y " + fmt(max) + ".");
        }
        return v;
    }

    private static String fmt(double d) {
        return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
    }

    private static String asset(JsonNode n, String field) {
        String s = text(n, 200, field, true);
        if (!validAsset(s)) throw ApiException.badRequest(field + " no es una imagen válida.");
        return s;
    }

    private static String color(JsonNode n, String field) {
        String s = text(n, 7, field, true);
        if (!COLOR.matcher(s).matches()) throw ApiException.badRequest(field + " debe ser un color #rrggbb.");
        return s;
    }

    private static void putNum(ObjectNode o, String key, Double v) {
        if (v != null) o.put(key, v);
    }

    /** Devuelve el spec normalizado o lanza ApiException (400) con un mensaje en español. */
    public static ObjectNode parse(JsonNode r) {
        if (r == null || !r.isObject()) throw ApiException.badRequest("Falta el guion del video.");
        JsonNode b = r.path("brand");
        ObjectNode out = MAPPER.createObjectNode();
        ObjectNode brand = out.putObject("brand");
        String mascot = text(b.path("mascot"), 200, "La mascota", false);
        if (mascot.isEmpty()) mascot = "brindix";
        brand.put("name", text(b.path("name"), 40, "El nombre de la marca", true));
        brand.put("from", color(b.path("from"), "El color inicial"));
        brand.put("mid", color(b.path("mid"), "El color medio"));
        brand.put("to", color(b.path("to"), "El color final"));
        brand.put("accent", color(b.path("accent"), "El color de acento"));
        brand.put("bgFrom", color(b.path("bgFrom"), "El fondo inicial"));
        brand.put("bgTo", color(b.path("bgTo"), "El fondo final"));
        brand.put("logo", asset(b.path("logo"), "El logo"));
        brand.put("mascot", mascot.equals("brindix") ? "brindix" : asset(b.path("mascot"), "La mascota"));

        String format = r.path("format").asText("");
        out.put("format", FORMATS.contains(format) ? format : "9x16");
        out.put("guide", r.path("guide").asBoolean(false));

        JsonNode intro = r.path("intro");
        ObjectNode oi = out.putObject("intro");
        oi.put("title", text(intro.path("title"), 50, "El título de la intro", true));
        String isub = text(intro.path("sub"), 90, "El subtítulo de la intro", false);
        if (!isub.isEmpty()) oi.put("sub", isub);
        putNum(oi, "seconds", num(intro.path("seconds"), 1, 8, "Los segundos de la intro"));

        JsonNode scenes = r.path("scenes");
        if (!scenes.isArray() || scenes.size() < 1 || scenes.size() > 12) throw ApiException.badRequest("El video necesita entre 1 y 12 escenas.");
        ArrayNode os = out.putArray("scenes");
        for (int i = 0; i < scenes.size(); i++) {
            JsonNode s = scenes.get(i);
            int n = i + 1;
            ObjectNode o = os.addObject();
            o.put("image", asset(s.path("image"), "La imagen de la escena " + n));
            o.put("title", text(s.path("title"), 60, "El título de la escena " + n, true));
            String sub = text(s.path("sub"), 90, "El subtítulo de la escena " + n, false);
            if (!sub.isEmpty()) o.put("sub", sub);
            JsonNode callouts = s.path("callouts");
            if (callouts.isArray() && callouts.size() > 5) throw ApiException.badRequest("La escena " + n + " admite hasta 5 recuadros.");
            ArrayNode oc = o.putArray("callouts");
            if (callouts.isArray()) {
                for (JsonNode c : callouts) {
                    ObjectNode co = oc.addObject();
                    Double x = num(c.path("x"), 0, 100, "La posición X");
                    Double y = num(c.path("y"), 0, 100, "La posición Y");
                    co.put("x", x == null ? 50 : x);
                    co.put("y", y == null ? 50 : y);
                    co.put("text", text(c.path("text"), 60, "El texto de un recuadro de la escena " + n, true));
                }
            }
            String pose = s.path("mascot").path("pose").asText("");
            ObjectNode om = o.putObject("mascot");
            om.put("pose", POSES.contains(pose) ? pose : "none");
            om.put("side", "left".equals(s.path("mascot").path("side").asText("")) ? "left" : "right");
            putNum(o, "seconds", num(s.path("seconds"), 1.5, 15, "Los segundos de la escena " + n));
        }

        JsonNode outro = r.path("outro");
        ObjectNode oo = out.putObject("outro");
        oo.put("title", text(outro.path("title"), 60, "El título del cierre", true));
        oo.put("cta", text(outro.path("cta"), 60, "El llamado a la acción", true));
        putNum(oo, "seconds", num(outro.path("seconds"), 1, 8, "Los segundos del cierre"));
        return out;
    }

    private static String img(String name) {
        return "proyectos/brindix/imagenes/frontend_public_demo-assets_" + name;
    }

    private static ObjectNode scene(String image, String title, String sub, int[][] pos, String[] texts, String pose, String side) {
        ObjectNode o = MAPPER.createObjectNode();
        o.put("image", image);
        o.put("title", title);
        if (sub != null) o.put("sub", sub);
        ArrayNode a = o.putArray("callouts");
        for (int i = 0; i < pos.length; i++) a.addObject().put("x", pos[i][0]).put("y", pos[i][1]).put("text", texts[i]);
        o.putObject("mascot").put("pose", pose).put("side", side);
        return o;
    }

    /** Punto de partida de un video nuevo. */
    public static ObjectNode brindixTemplate() {
        ObjectNode t = MAPPER.createObjectNode();
        t.putObject("brand").put("name", "Brindix").put("from", "#ffb238").put("mid", "#ff7a45").put("to", "#ff4f8b")
                .put("accent", "#3ee0d0").put("bgFrom", "#0f0d0b").put("bgTo", "#2a1a2e")
                .put("logo", "proyectos/brindix/marca/frontend_public_demo-assets_candela-logo.png").put("mascot", "brindix");
        t.put("format", "9x16");
        t.put("guide", true);
        t.putObject("intro").put("title", "Brindix").put("sub", "Carta, pedidos y cuenta de tu bar en el celular");
        ArrayNode s = t.putArray("scenes");
        s.add(scene(img("michelada-m.jpg"), "Tu carta digital, con un QR", "El cliente la abre sin descargar nada",
                new int[][]{{50, 22}, {50, 55}, {50, 82}},
                new String[]{"Escanea el QR de la mesa", "Fotos que antojan", "Precios siempre al día"}, "wave", "right"));
        s.add(scene(img("barra.jpg"), "Pide directo a la barra", "Sin filas ni gritos",
                new int[][]{{50, 35}, {50, 70}},
                new String[]{"Elige y agrega a tu pedido", "Llega a la barra al instante"}, "point", "left"));
        s.add(scene(img("mojito-s.jpg"), "El mesero recibe todo", "Cada mesa, su pedido en pantalla",
                new int[][]{{50, 30}, {50, 60}, {50, 85}},
                new String[]{"Aviso en su celular", "Sabe qué mesa pidió", "Menos errores, más rapidez"}, "celebrate", "right"));
        s.add(scene(img("shots-m.jpg"), "Cuenta y propina claras", "Todo queda registrado",
                new int[][]{{50, 30}, {50, 70}},
                new String[]{"Cuenta por mesa al día", "Propina sugerida en un toque"}, "wave", "left"));
        s.add(scene(img("picada-s.jpg"), "Combos y promos que venden", "Destaca lo que más quieres vender",
                new int[][]{{50, 35}, {50, 75}},
                new String[]{"Resalta tus mejores platos", "Cambia la carta en segundos"}, "point", "right"));
        s.add(scene(img("club-dorada-s.jpg"), "Tu panel de dueño", "Controla el bar desde donde estés",
                new int[][]{{50, 25}, {50, 55}, {50, 82}},
                new String[]{"Ventas del día en vivo", "Pedidos y propinas por mesero", "Todo desde tu celular"}, "celebrate", "left"));
        t.putObject("outro").put("title", "Lleva tu bar al siguiente nivel").put("cta", "Pruébalo en tu bar");
        return t;
    }
}
