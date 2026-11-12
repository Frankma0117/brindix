package com.brindix.inventory;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    @Query("""
            select m from StockMovement m
            where m.venueId = :venueId
              and (:productId is null or m.productId = :productId)
              and (:type is null or m.type = :type)
              and m.createdAt >= :from and m.createdAt < :to
            order by m.createdAt desc, m.id desc
            """)
    List<StockMovement> search(Long venueId, Long productId, MovementType type, Instant from, Instant to, Pageable page);
}
