package com.brindix.publisher;

import com.brindix.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Publicador de redes de Brindix: solo el súper administrador, como sección de /plataforma (/api/platform/** exige SUPERADMIN). */
@RestController
@RequestMapping("/api/platform/publisher")
public class PublisherController {

    private final PublisherClient publisher;

    public PublisherController(PublisherClient publisher) {
        this.publisher = publisher;
    }

    /** ¿Está configurado y respondiendo? */
    @GetMapping("/status")
    public Map<String, Boolean> status() {
        return Map.of("enabled", publisher.enabled(), "up", publisher.up());
    }

    /** Dirección de un solo uso (60 s) para abrir el publicador con la sesión actual: {"url": "/publicador/sso?ticket=…"}. */
    @PostMapping("/ticket")
    public Map<String, String> ticket() {
        if (!publisher.enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "El publicador no está configurado en el servidor.");
        if (!publisher.up()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "El publicador no responde. Inténtalo en un minuto.");
        return Map.of("url", publisher.ticketUrl());
    }
}
