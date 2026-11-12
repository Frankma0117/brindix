package com.brindix.security;

import com.brindix.common.ApiException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Tras 5 intentos fallidos con el mismo usuario se bloquea 15 minutos. */
@Component
public class LoginGuard {

    private static final int MAX_FAILS = 5;
    private static final long LOCK_SECONDS = 15 * 60;
    private final Map<String, long[]> fails = new ConcurrentHashMap<>();

    public void check(String key) {
        long[] f = fails.get(key);
        if (f != null && f[0] >= MAX_FAILS && now() - f[1] < LOCK_SECONDS) {
            throw ApiException.tooMany("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
        }
    }

    public void failed(String key) {
        long now = now();
        fails.merge(key, new long[]{1, now}, (a, b) -> new long[]{now - a[1] > LOCK_SECONDS ? 1 : a[0] + 1, now});
    }

    public void ok(String key) {
        fails.remove(key);
    }

    private static long now() {
        return Instant.now().getEpochSecond();
    }
}
