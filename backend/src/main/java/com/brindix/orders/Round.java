package com.brindix.orders;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Una ronda (tanda): varios productos que se piden, se llevan y se pueden cobrar juntos. */
@Entity
@Table(name = "rounds")
@Getter
@Setter
public class Round {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long tabId;

    @Enumerated(EnumType.STRING)
    private RoundSource source;

    @Enumerated(EnumType.STRING)
    private RoundStatus status;

    private Long createdBy;
    /** Mesero que la lleva a la mesa. */
    private Long assignedTo;
    private Long handledBy;
    /** Cobro que la pagó (null = sin pagar). */
    private Long paymentId;
    private String clientName;
    private String note;
    private String rejectReason;
    private Instant createdAt = Instant.now();
    private Instant confirmedAt;
    private Instant deliveredAt;

    @OneToMany(mappedBy = "round", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<RoundItem> items = new ArrayList<>();

    public void addItem(RoundItem item) {
        item.setRound(this);
        items.add(item);
    }

    public BigDecimal total() {
        return items.stream().filter(i -> !i.isVoided()).map(RoundItem::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal cost() {
        return items.stream().filter(i -> !i.isVoided()).map(RoundItem::lineCost).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Se puede cobrar: confirmada o entregada, sin pagar y con algo que cobrar. */
    public boolean payable() {
        return status.counts() && paymentId == null && total().signum() > 0;
    }
}
