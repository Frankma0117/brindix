package com.brindix.publisher;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

/** El ticket debe cumplir exactamente la especificación del publicador (publisher-app, docs/INCRUSTADO.md). */
class PublisherTicketTest {

    private static String hmac(String secret, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void ticketHasPayloadAndValidSignature() throws Exception {
        String ticket = PublisherTicket.create("secreto-de-prueba", 60);
        String[] parts = ticket.split("\\.");
        assertEquals(2, parts.length);
        assertEquals(hmac("secreto-de-prueba", parts[0]), parts[1]);
        JsonNode payload = new ObjectMapper().readTree(Base64.getUrlDecoder().decode(parts[0]));
        long now = System.currentTimeMillis() / 1000;
        assertTrue(payload.get("exp").asLong() > now && payload.get("exp").asLong() <= now + 61);
        assertEquals(24, payload.get("n").asText().length(), "12 bytes en hex");
    }

    @Test
    void everyTicketIsDifferent() {
        assertNotEquals(PublisherTicket.create("s", 60), PublisherTicket.create("s", 60));
    }

    @Test
    void anotherSecretGivesAnotherSignature() throws Exception {
        String ticket = PublisherTicket.create("uno", 60);
        assertNotEquals(hmac("otro", ticket.split("\\.")[0]), ticket.split("\\.")[1]);
    }
}
