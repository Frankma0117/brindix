package com.brindix.orders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByShiftIdOrderByCollectedAtAsc(Long shiftId);

    List<Payment> findByTabIdOrderByCollectedAtAsc(Long tabId);

    List<Payment> findByVenueIdAndSettledFalseAndVoidedFalseOrderByCollectedAtAsc(Long venueId);

    @Query("select p from Payment p where p.venueId = :venueId and p.voided = false and p.collectedAt >= :from and p.collectedAt < :to order by p.collectedAt asc")
    List<Payment> findBetween(Long venueId, Instant from, Instant to);
}
