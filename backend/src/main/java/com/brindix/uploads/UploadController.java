package com.brindix.uploads;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import com.brindix.security.CurrentUser;
import com.brindix.venue.VenueService;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

/** Fotos de productos, logo y banners (solo administrador). */
@RestController
public class UploadController {

    private static final Set<String> FOLDERS = Set.of("products", "banners", "logo");

    private final StorageService storage;
    private final VenueService venues;

    public UploadController(StorageService storage, VenueService venues) {
        this.storage = storage;
        this.venues = venues;
    }

    @PostMapping("/api/admin/uploads")
    public Map<String, String> upload(@RequestParam("file") MultipartFile file,
                                      @RequestParam(defaultValue = "products") String folder) throws IOException {
        if (file.isEmpty()) throw ApiException.badRequest("El archivo está vacío");
        String slug = venues.get(CurrentUser.get().venueId()).getSlug();
        return Map.of("url", storage.saveImage(slug, FOLDERS.contains(folder) ? folder : "products", file.getBytes()));
    }

    /** En modo local sirve las imágenes guardadas en disco. */
    @Configuration
    static class UploadsWebConfig implements WebMvcConfigurer {
        private final AppProperties props;

        UploadsWebConfig(AppProperties props) {
            this.props = props;
        }

        @Override
        public void addResourceHandlers(ResourceHandlerRegistry registry) {
            String location = Path.of(props.uploadsDir()).toAbsolutePath().normalize().toUri().toString();
            registry.addResourceHandler("/uploads/**")
                    .addResourceLocations(location.endsWith("/") ? location : location + "/")
                    .setCachePeriod(60 * 60 * 24 * 30);
        }
    }
}
