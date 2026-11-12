package com.brindix.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/** Códigos de un solo uso para recuperar contraseñas: 8 caracteres sin letras confusas; se guarda solo su SHA-256. */
public final class OneTimeCode {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private OneTimeCode() {}

    /** Código nuevo, sin guion (ABCD2345). */
    public static String generate() {
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    /** Para mostrar: ABCD-2345. */
    public static String pretty(String code) {
        return code.substring(0, 4) + "-" + code.substring(4);
    }

    /** Lo que escribió la persona, sin guiones ni espacios y en mayúsculas. */
    public static String normalize(String input) {
        return input == null ? "" : input.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }

    public static String hash(String code) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Compara en tiempo constante el código escrito con el hash guardado. */
    public static boolean matches(String input, String storedHash) {
        if (storedHash == null) return false;
        return MessageDigest.isEqual(hash(normalize(input)).getBytes(StandardCharsets.UTF_8), storedHash.getBytes(StandardCharsets.UTF_8));
    }
}
