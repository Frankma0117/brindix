package com.brindix.videos.studio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Un guion del Taller de video (spec JSON) y el estado de su grabación. */
@Entity
@Table(name = "video_specs")
@Getter
@Setter
public class VideoSpecRow {

    public static final String DRAFT = "draft";
    public static final String RENDERING = "rendering";
    public static final String REVIEW = "review";
    public static final String APPROVED = "approved";
    public static final String ERROR = "error";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    @Column(columnDefinition = "TEXT")
    private String spec;
    private String status = DRAFT;
    private String detail;
    private String url;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}
