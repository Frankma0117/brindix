package com.brindix.venue;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Un negocio dentro de Brindix. Cada bar tiene su carta, equipo, caja, música y pantalla. */
@Entity
@Table(name = "venues")
@Getter
@Setter
public class Venue {

    public enum MusicProvider { MANUAL, SPOTIFY, YOUTUBE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    /** Parte de la dirección: brindix.cania.app/{slug} */
    private String slug;
    private String tagline;
    private String logoUrl;
    private String currency = "COP";
    private String wifiName;
    private String wifiPassword;
    private boolean active = true;
    private String contactName;
    private String contactPhone;

    /** El cliente puede pedir desde el QR (si no, solo ve la carta). */
    private boolean clientOrdersEnabled = false;
    /** El mesero puede cobrar (queda pendiente de entregar el dinero en caja). */
    private boolean waiterCanCharge = true;

    private boolean musicEnabled = true;
    private boolean songApproval = false;
    private int maxSongsPerTable = 3;
    @Enumerated(EnumType.STRING)
    private MusicProvider musicProvider = MusicProvider.MANUAL;

    private String spotifyClientId;
    /** Cifrados con Crypto. */
    private String spotifyClientSecret;
    private String spotifyAccessToken;
    private String spotifyRefreshToken;
    private Instant spotifyExpiresAt;
    private String spotifyAccount;
    private String youtubeApiKey;

    /** Llave de la pantalla del TV: con ella la pantalla puede reproducir y avanzar la cola (YouTube). */
    private String screenKey;
    private Instant createdAt = Instant.now();

    public boolean spotifyConnected() {
        return spotifyRefreshToken != null && !spotifyRefreshToken.isBlank();
    }
}
