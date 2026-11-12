package com.brindix.common;

import jakarta.servlet.http.HttpServletRequest;

/** IP del cliente detrás de los nginx (X-Real-IP / X-Forwarded-For); solo para límites de intentos y bitácora. */
public final class ClientIp {

    private ClientIp() {}

    public static String of(HttpServletRequest req) {
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
