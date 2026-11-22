package com.brindix.videos.studio;

import com.brindix.common.ApiException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VideoSpecValidatorTest {

    @Test
    void templateIsValid() {
        ObjectNode spec = VideoSpecValidator.parse(VideoSpecValidator.brindixTemplate());
        assertEquals(8, spec.path("scenes").size());
        assertTrue(spec.path("guide").asBoolean());
        ObjectNode off = VideoSpecValidator.brindixTemplate();
        off.remove("guide");
        assertFalse(VideoSpecValidator.parse(off).path("guide").asBoolean());
        assertEquals("brindix", spec.path("brand").path("mascot").asText());
    }

    @Test
    void rejectsPathTraversalAndOtherProjects() {
        assertFalse(VideoSpecValidator.validAsset("proyectos/brindix/../canix/a.png"));
        assertFalse(VideoSpecValidator.validAsset("proyectos/canix/imagenes/a.png"));
        assertTrue(VideoSpecValidator.validAsset("proyectos/brindix/imagenes/a.jpg"));
    }

    @Test
    void rejectsBadColorAndTooManyCallouts() {
        ObjectNode bad = VideoSpecValidator.brindixTemplate();
        ((ObjectNode) bad.path("brand")).put("from", "naranja");
        assertThrows(ApiException.class, () -> VideoSpecValidator.parse(bad));

        ObjectNode many = VideoSpecValidator.brindixTemplate();
        var callouts = (com.fasterxml.jackson.databind.node.ArrayNode) many.path("scenes").get(0).path("callouts");
        for (int i = 0; i < 5; i++) callouts.addObject().put("text", "x");
        assertThrows(ApiException.class, () -> VideoSpecValidator.parse(many));
    }

    @Test
    void keepsSayAndDropsClientAudio() {
        ObjectNode t = VideoSpecValidator.brindixTemplate();
        t.put("audio", "proyectos/brindix/audio/brindix-1.mp3");
        t.with("intro").put("say", "Hola");
        ((ObjectNode) t.path("scenes").get(0)).put("say", "Mira la carta");
        t.with("outro").put("say", "Pruébalo");
        ObjectNode out = VideoSpecValidator.parse(t);
        assertFalse(out.has("audio"));
        assertEquals("Hola", out.path("intro").path("say").asText());
        assertEquals("Mira la carta", out.path("scenes").get(0).path("say").asText());
        assertEquals("Pruébalo", out.path("outro").path("say").asText());
        assertFalse(out.path("scenes").get(1).has("say"));
    }

    @Test
    void rejectsLongSay() {
        ObjectNode t = VideoSpecValidator.brindixTemplate();
        ((ObjectNode) t.path("scenes").get(0)).put("say", "a".repeat(301));
        assertThrows(ApiException.class, () -> VideoSpecValidator.parse(t));
    }
}
