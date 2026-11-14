package com.brindix.publisher;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Ticket de un solo uso con el que el súper administrador entra al publicador de redes sin otro login.
 * Formato (publisher-app, docs/INCRUSTADO.md): payload = base64url({"exp":segundos,"n":aleatorio}),
 * ticket = payload + "." + hex(HMAC-SHA256(secreto, payload)).
 */
public final class PublisherTicket {

    private static final SecureRandom RANDOM = new SecureRandom();

    private PublisherTicket() {}

    public static String create(String secret, long ttlSeconds) {
        try {
            byte[] n = new byte[12];
            RANDOM.nextBytes(n);
            String json = "{\"exp\":" + (System.currentTimeMillis() / 1000 + ttlSeconds) + ",\"n\":\"" + HexFormat.of().formatHex(n) + "\"}";
            String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return payload + "." + HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo crear el ticket del publicador", e);
        }
    }
}
