package com.brindix.publisher;

import com.brindix.common.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** El cliente contra un publicador simulado (JDK HttpServer). */
class PublisherClientTest {

    private HttpServer server;
    private final List<String> auth = new ArrayList<>();
    private final List<JsonNode> bodies = new ArrayList<>();
    private int status = 201;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/publicador/api/health", ex -> {
            byte[] ok = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, ok.length);
            ex.getResponseBody().write(ok);
            ex.close();
        });
        server.createContext("/publicador/api/v1/assets", ex -> {
            auth.add(ex.getRequestHeaders().getFirst("Authorization"));
            bodies.add(new ObjectMapper().readTree(ex.getRequestBody().readAllBytes()));
            byte[] out = "{}".getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private PublisherClient client(String key) {
        String url = "http://127.0.0.1:" + server.getAddress().getPort();
        AppProperties props = new AppProperties(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new AppProperties.Publisher(url, key, "embed-secret"));
        return new PublisherClient(props);
    }

    @Test
    void pushSendsThePendingVideoWithTheKey() {
        PublisherClient c = client("pk-123");
        assertTrue(c.enabled());
        assertTrue(c.up());
        c.push("https://cdn.example/v.mp4", "Mojito · vertical", "Receta", "promo-video-7", "https://cdn.example/p.jpg");
        assertEquals("Bearer pk-123", auth.get(0));
        JsonNode b = bodies.get(0);
        assertEquals("https://cdn.example/v.mp4", b.get("url").asText());
        assertEquals("promo-video-7", b.get("ref").asText());
        assertEquals("pending", b.get("status").asText());
        assertEquals("https://cdn.example/p.jpg", b.get("thumbnailUrl").asText());
    }

    @Test
    void aNonHttpsPosterIsLeftOut() {
        client("k").push("https://cdn.example/v.mp4", "t", null, "r", "/uploads/p.jpg");
        assertFalse(bodies.get(0).has("thumbnailUrl"));
        assertEquals("", bodies.get(0).get("caption").asText());
    }

    @Test
    void aFailureIsThrownSoItCanBeRetried() {
        status = 500;
        assertThrows(Exception.class, () -> client("k").push("https://cdn.example/v.mp4", "t", "c", "r", null));
    }

    @Test
    void withoutConfigurationItIsOff() {
        AppProperties off = new AppProperties(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                new AppProperties.Publisher("", "", ""));
        PublisherClient c = new PublisherClient(off);
        assertFalse(c.enabled());
        assertFalse(c.up());
    }

    @Test
    void ticketUrlPointsToTheBasePath() {
        String url = client("k").ticketUrl();
        assertTrue(url.startsWith("/publicador/sso?ticket="));
    }

    @Test
    void formatLabels() {
        assertEquals(" · vertical", PublisherSync.formatLabel("vertical"));
        assertEquals(" · horizontal", PublisherSync.formatLabel("landscape"));
        assertEquals("", PublisherSync.formatLabel(null));
    }
}
