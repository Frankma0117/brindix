package com.brindix.orders;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "service_calls")
@Getter
@Setter
public class ServiceCall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private Long tableId;

    @Enumerated(EnumType.STRING)
    private CallType type;

    @Enumerated(EnumType.STRING)
    private CallStatus status = CallStatus.OPEN;

    private Instant createdAt = Instant.now();
    private Instant doneAt;
    private Long doneBy;
}
