package com.brindix.customers;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Cliente al que el bar le fía. Su saldo sale de los cobros CREDIT menos sus abonos. */
@Entity
@Table(name = "customers")
@Getter
@Setter
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String name;
    private String phone;
    private String note;
    private boolean archived;
    private Instant createdAt = Instant.now();
}
