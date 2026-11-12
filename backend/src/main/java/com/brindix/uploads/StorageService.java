package com.brindix.uploads;

import com.brindix.common.ApiException;
import com.brindix.common.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ObjectCannedACL;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/**
 * Guarda imágenes en DigitalOcean Spaces (bucket compartido, todo bajo SPACES_PREFIX/<bar>/)
 * o, si no hay credenciales, en la carpeta local BRINDIX_UPLOADS_DIR servida en /uploads/.
 * Las fotos grandes se reducen a 1600 px y se guardan como JPG para que la carta cargue rápido.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);
    private static final int MAX_SIDE = 1600;
    private static final Map<String, String> TYPES = Map.of("jpg", "image/jpeg", "png", "image/png", "webp", "image/webp", "gif", "image/gif");

    private final AppProperties.Storage cfg;
    private final Path localDir;
    private final S3Client s3;

    public StorageService(AppProperties props) throws IOException {
        this.cfg = props.storage();
        this.localDir = Path.of(props.uploadsDir()).toAbsolutePath().normalize();
        Files.createDirectories(localDir);
        if (cfg.spaces()) {
            this.s3 = S3Client.builder()
                    .endpointOverride(URI.create(cfg.endpoint()))
                    .region(Region.of(cfg.region()))
                    .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(cfg.key(), cfg.secret())))
                    .httpClient(UrlConnectionHttpClient.create())
                    .build();
            log.info("Imágenes en Spaces: {}/{}/", cfg.bucket(), cfg.prefix());
        } else {
            this.s3 = null;
            log.info("Imágenes en disco: {}", localDir);
        }
    }

    public String mode() {
        return s3 != null ? "spaces" : "local";
    }

    /** Guarda una imagen y devuelve su URL pública. */
    public String saveImage(String venueSlug, String folder, byte[] data) {
        String ext = detect(data);
        if (ext == null) throw ApiException.badRequest("Sube una imagen JPG, PNG, WEBP o GIF");
        byte[] out = data;
        if (ext.equals("jpg") || ext.equals("png")) {
            byte[] shrunk = shrink(data, ext);
            if (shrunk != null) {
                out = shrunk;
                ext = "jpg";
            }
        }
        String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        String rel = safe(venueSlug) + "/" + safe(folder) + "/" + name;
        if (s3 != null) {
            String key = (cfg.prefix() == null || cfg.prefix().isBlank() ? "" : cfg.prefix().replaceAll("/+$", "") + "/") + rel;
            s3.putObject(PutObjectRequest.builder().bucket(cfg.bucket()).key(key).acl(ObjectCannedACL.PUBLIC_READ)
                    .contentType(TYPES.get(ext)).cacheControl("public, max-age=31536000, immutable").build(), RequestBody.fromBytes(out));
            return publicBase() + "/" + key;
        }
        try {
            Path file = localDir.resolve(rel).normalize();
            if (!file.startsWith(localDir)) throw ApiException.badRequest("Ruta inválida");
            Files.createDirectories(file.getParent());
            Files.write(file, out);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo guardar la imagen", e);
        }
        return "/uploads/" + rel;
    }

    private String publicBase() {
        if (cfg.cdnUrl() != null && !cfg.cdnUrl().isBlank()) return cfg.cdnUrl().replaceAll("/+$", "");
        String host = URI.create(cfg.endpoint()).getHost();
        return "https://" + cfg.bucket() + "." + host;
    }

    /** Reduce a 1600 px como máximo. null si no hace falta o no se pudo (se guarda el original). */
    private static byte[] shrink(byte[] data, String ext) {
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(data));
            if (src == null) return null;
            int w = src.getWidth(), h = src.getHeight();
            boolean big = Math.max(w, h) > MAX_SIDE;
            if (!big && ext.equals("jpg") && data.length < 600_000) return null;
            if (ext.equals("png") && src.getColorModel().hasAlpha()) return null;
            double scale = big ? (double) MAX_SIDE / Math.max(w, h) : 1;
            int nw = (int) Math.round(w * scale), nh = (int) Math.round(h * scale);
            BufferedImage dst = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = dst.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, nw, nh);
            g.drawImage(src, 0, 0, nw, nh, null);
            g.dispose();
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
            ImageWriteParam p = writer.getDefaultWriteParam();
            p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            p.setCompressionQuality(0.84f);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (ImageOutputStream ios = ImageIO.createImageOutputStream(bos)) {
                writer.setOutput(ios);
                writer.write(null, new IIOImage(dst, null, null), p);
            } finally {
                writer.dispose();
            }
            byte[] out = bos.toByteArray();
            return out.length < data.length || big ? out : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Revisa la firma del archivo: no basta con la extensión. */
    static String detect(byte[] h) {
        if (h == null || h.length < 12) return null;
        if ((h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8) return "jpg";
        if ((h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return "png";
        if (h[0] == 'G' && h[1] == 'I' && h[2] == 'F') return "gif";
        if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }

    private static String safe(String s) {
        String v = s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9-]", "");
        return v.isEmpty() ? "x" : v;
    }
}
