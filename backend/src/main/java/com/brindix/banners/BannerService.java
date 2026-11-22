package com.brindix.banners;

import com.brindix.catalog.Product;
import com.brindix.catalog.ProductRepository;
import com.brindix.common.ApiException;
import com.brindix.venue.Venue;
import com.brindix.venue.VenueRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class BannerService {

    private final BannerRepository banners;
    private final ProductRepository products;
    private final VenueRepository venues;

    public BannerService(BannerRepository banners, ProductRepository products, VenueRepository venues) {
        this.venues = venues;
        this.banners = banners;
        this.products = products;
    }

    public record BannerInput(@NotBlank @Size(max = 120) String title, @Size(max = 300) String subtitle,
                              @Size(max = 500) String imageUrl, @Size(max = 30) String theme,
                              @Min(3) @Max(120) int durationSeconds, int sortOrder, boolean active,
                              Instant startsAt, Instant endsAt, Long productId,
                              Instant eventDate, @Size(max = 30) String eventKind, boolean ctaWhatsapp) {}

    public record BannerView(Long id, String title, String subtitle, String imageUrl, String theme, int durationSeconds,
                             int sortOrder, boolean active, Instant startsAt, Instant endsAt, Long productId,
                             String productName, BigDecimal productPrice, String productImage, boolean live,
                             Instant eventDate, String eventKind, boolean ctaWhatsapp, String whatsappPhone) {}

    @Transactional(readOnly = true)
    public List<BannerView> list(Long venueId, boolean onlyLive) {
        Instant now = Instant.now();
        List<Banner> list = banners.findByVenueIdOrderBySortOrderAscIdAsc(venueId).stream()
                .filter(b -> !onlyLive || b.liveAt(now)).toList();
        Map<Long, Product> prods = products.findAllById(list.stream().map(Banner::getProductId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Product::getId, p -> p));
        String wa = whatsapp(venueId);
        return list.stream().map(b -> {
            Product p = b.getProductId() == null ? null : prods.get(b.getProductId());
            return new BannerView(b.getId(), b.getTitle(), b.getSubtitle(), b.getImageUrl(), b.getTheme(), b.getDurationSeconds(),
                    b.getSortOrder(), b.isActive(), b.getStartsAt(), b.getEndsAt(), b.getProductId(),
                    p == null ? null : p.getName(), p == null ? null : p.getPrice(), p == null ? null : p.getImageUrl(), b.liveAt(now),
                    b.getEventDate(), b.getEventKind(), b.isCtaWhatsapp(), b.isCtaWhatsapp() ? wa : null);
        }).toList();
    }

    @Transactional
    public void save(Long venueId, Long id, BannerInput in) {
        Banner b = id == null ? new Banner() : owned(venueId, id);
        if (in.endsAt() != null && in.startsAt() != null && !in.endsAt().isAfter(in.startsAt())) {
            throw ApiException.badRequest("La fecha final debe ser después de la inicial");
        }
        if (in.productId() != null) {
            products.findById(in.productId()).filter(p -> p.getVenueId().equals(venueId))
                    .orElseThrow(() -> ApiException.notFound("Producto no encontrado"));
        }
        b.setVenueId(venueId);
        b.setTitle(in.title().trim());
        b.setSubtitle(blank(in.subtitle()));
        b.setImageUrl(blank(in.imageUrl()));
        b.setTheme(in.theme() == null || in.theme().isBlank() ? "amber" : in.theme());
        b.setDurationSeconds(in.durationSeconds());
        b.setSortOrder(in.sortOrder());
        b.setActive(in.active());
        b.setStartsAt(in.startsAt());
        b.setEndsAt(in.endsAt());
        b.setProductId(in.productId());
        b.setEventDate(in.eventDate());
        b.setEventKind(blank(in.eventKind()));
        b.setCtaWhatsapp(in.ctaWhatsapp());
        banners.save(b);
    }

    @Transactional
    public void delete(Long venueId, Long id) {
        banners.delete(owned(venueId, id));
    }

    private Banner owned(Long venueId, Long id) {
        return banners.findById(id).filter(b -> b.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Banner no encontrado"));
    }

    /** Teléfono de contacto del bar en dígitos para wa.me (10 dígitos = Colombia, antepone 57); null si no hay. */
    private String whatsapp(Long venueId) {
        String raw = venues.findById(venueId).map(Venue::getContactPhone).orElse(null);
        if (raw == null) return null;
        String d = raw.replaceAll("\\D", "");
        if (d.length() < 7) return null;
        return d.length() == 10 ? "57" + d : d;
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
