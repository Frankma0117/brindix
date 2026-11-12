package com.brindix.venue;

import com.brindix.banners.Banner;
import com.brindix.banners.BannerRepository;
import com.brindix.common.AppProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.text.Normalizer;
import java.time.Duration;
import java.util.List;

/**
 * Lo que ven WhatsApp, Facebook, Telegram y compañía al compartir un enlace de un bar: el nginx del frontend
 * manda a esos lectores de enlaces aquí (no ejecutan JavaScript). También el buscador de bares del ingreso.
 */
@RestController
public class ShareController {

    private final VenueRepository venues;
    private final BannerRepository banners;
    private final AppProperties props;

    public ShareController(VenueRepository venues, BannerRepository banners, AppProperties props) {
        this.venues = venues;
        this.banners = banners;
        this.props = props;
    }

    /** Página mínima con etiquetas Open Graph del bar (o de Brindix si el bar no existe). */
    @GetMapping(value = "/api/public/{slug}/share", produces = "text/html;charset=UTF-8")
    public ResponseEntity<String> share(@PathVariable String slug, @RequestParam(defaultValue = "/") String path) {
        String base = props.publicBase();
        Venue v = venues.findBySlug(slug.toLowerCase()).filter(Venue::isActive).orElse(null);
        String title, description, image, url;
        if (v == null) {
            title = "Brindix · Tu bar en el celular de todos";
            description = "Carta con QR, rondas en dos toques, caja que cuadra y música a pedido.";
            image = base + "/og/brindix.jpg";
            url = base + "/";
        } else {
            boolean menu = path.contains("/m/");
            boolean screen = path.contains("/pantalla");
            title = v.getName() + (menu ? " · Carta y pedidos" : screen ? " · Pantalla" : "");
            description = v.getTagline() != null && !v.getTagline().isBlank() ? v.getTagline()
                    : "Mira la carta con fotos, pide desde tu mesa y pon tu canción.";
            if (menu) description = "Mira la carta con fotos, pide desde tu mesa y pon tu canción. " + description;
            image = banners.findByVenueIdOrderBySortOrderAscIdAsc(v.getId()).stream()
                    .filter(Banner::isActive).map(Banner::getImageUrl).filter(u -> u != null && !u.isBlank())
                    .findFirst().orElse(v.getLogoUrl() != null ? v.getLogoUrl() : base + "/og/brindix.jpg");
            if (image.startsWith("/")) image = base + image;
            url = base + (path.startsWith("/") ? path : "/" + path);
        }
        String html = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
                + "<title>" + esc(title) + "</title>"
                + "<meta name=\"description\" content=\"" + esc(description) + "\">"
                + "<meta property=\"og:type\" content=\"website\"><meta property=\"og:site_name\" content=\"Brindix\">"
                + "<meta property=\"og:locale\" content=\"es_CO\">"
                + "<meta property=\"og:url\" content=\"" + esc(url) + "\">"
                + "<meta property=\"og:title\" content=\"" + esc(title) + "\">"
                + "<meta property=\"og:description\" content=\"" + esc(description) + "\">"
                + "<meta property=\"og:image\" content=\"" + esc(image) + "\">"
                + "<meta name=\"twitter:card\" content=\"summary_large_image\">"
                + "<meta name=\"twitter:image\" content=\"" + esc(image) + "\">"
                + "</head><body><h1>" + esc(title) + "</h1><p>" + esc(description) + "</p></body></html>";
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(10))).body(html);
    }

    public record VenueHit(String slug, String name, String logoUrl) {}

    /** Buscador del ingreso: bares activos por nombre o dirección (mínimo 2 letras, máximo 6). */
    @GetMapping("/api/public/venues")
    public List<VenueHit> search(@RequestParam(defaultValue = "") String q) {
        String needle = norm(q);
        if (needle.length() < 2) return List.of();
        return venues.findAllByOrderByNameAsc().stream().filter(Venue::isActive)
                .filter(v -> norm(v.getName()).contains(needle) || v.getSlug().contains(needle.replace(' ', '-')))
                .limit(6).map(v -> new VenueHit(v.getSlug(), v.getName(), v.getLogoUrl())).toList();
    }

    private static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
    }

    /** Solo lo necesario; las tildes van en UTF-8 (algunos lectores de enlaces no decodifican &oacute;). */
    private static String esc(String s) {
        return (s == null ? "" : s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
