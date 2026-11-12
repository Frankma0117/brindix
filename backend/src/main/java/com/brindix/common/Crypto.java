package com.brindix.common;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifra con AES-GCM las claves que cada bar guarda en su configuración (Spotify, YouTube),
 * para que no queden en texto plano en la base de datos. La llave sale de BRINDIX_SECRET_KEY.
 */
@Component
public class Crypto {

    private static final String PREFIX = "v1:";
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public Crypto(AppProperties props) {
        try {
            byte[] k = MessageDigest.getInstance("SHA-256").digest(props.secretKey().getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(k, "AES");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public String encrypt(String plain) {
        if (plain == null || plain.isEmpty()) return null;
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + enc.length).put(iv).put(enc).array());
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo cifrar", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || stored.isEmpty()) return null;
        if (!stored.startsWith(PREFIX)) return stored;
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Si cambió BRINDIX_SECRET_KEY las claves guardadas ya no se pueden leer: hay que volver a ponerlas.
            return null;
        }
    }

    /** "••••1234" para mostrar que hay una clave sin revelarla. */
    public static String mask(String plain) {
        if (plain == null || plain.isBlank()) return null;
        return "••••" + plain.substring(Math.max(0, plain.length() - 4));
    }
}
