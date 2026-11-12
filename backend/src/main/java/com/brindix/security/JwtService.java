package com.brindix.security;

import com.brindix.common.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    /** staff = usuario de un bar. platform = súper administrador. */
    public enum Kind { STAFF, PLATFORM }

    public record Subject(Kind kind, Long id) {}

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(sha256(props.jwt().secret()));
        this.ttl = Duration.ofHours(Math.max(1, props.jwt().hours()));
    }

    public String issue(Kind kind, Long id) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(id))
                .claim("typ", kind.name().toLowerCase())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    public Optional<Subject> parse(String token) {
        return claims(token).flatMap(c -> {
            String typ = c.get("typ", String.class);
            if ("staff".equals(typ)) return Optional.of(new Subject(Kind.STAFF, Long.valueOf(c.getSubject())));
            if ("platform".equals(typ)) return Optional.of(new Subject(Kind.PLATFORM, Long.valueOf(c.getSubject())));
            return Optional.empty();
        });
    }

    /** "state" firmado para el viaje de ida y vuelta a Spotify (10 minutos). */
    public String issueState(Long venueId) {
        Instant now = Instant.now();
        return Jwts.builder().subject(String.valueOf(venueId)).claim("typ", "spotify-state")
                .issuedAt(Date.from(now)).expiration(Date.from(now.plus(Duration.ofMinutes(10)))).signWith(key).compact();
    }

    public Optional<Long> parseState(String state) {
        return claims(state).filter(c -> "spotify-state".equals(c.get("typ", String.class))).map(c -> Long.valueOf(c.getSubject()));
    }

    private Optional<Claims> claims(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            return Optional.of(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static byte[] sha256(String secret) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
