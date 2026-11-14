package com.brindix.videos;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Un video de tutorial o publicidad de Brindix. Lo arma el estudio (servicio aparte); aquí solo queda el estado y las URLs. */
@Entity
@Table(name = "promo_videos")
@Getter
@Setter
public class PromoVideo {

    public enum Status { QUEUED, RUNNING, DONE, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long createdBy;
    /** Pedido del estudio: los formatos de un mismo clic comparten jobId. */
    private String jobId;
    private String kind;
    private String kindName;
    private String format;
    private String voice;
    private String music;
    private String idea;
    @Enumerated(EnumType.STRING)
    private Status status = Status.QUEUED;
    private int progress;
    private String detail;
    private String title;
    @Column(columnDefinition = "TEXT")
    private String caption;
    /** Guion final en JSON: [{shot, headline, say}]. */
    @Column(columnDefinition = "TEXT")
    private String script;
    private String videoUrl;
    private String posterUrl;
    private Double seconds;
    /** Ya se envió al publicador de redes (bandeja «Por validar»). */
    private boolean publisherSent;
    private Instant createdAt = Instant.now();
    private Instant finishedAt;
}
