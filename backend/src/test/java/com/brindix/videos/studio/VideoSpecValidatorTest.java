package com.brindix.videos.studio;

import com.brindix.common.ApiException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VideoSpecValidatorTest {

    @Test
    void templateIsValid() {
        ObjectNode spec = VideoSpecValidator.parse(VideoSpecValidator.brindixTemplate());
        assertEquals(3, spec.path("scenes").size());
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
}
