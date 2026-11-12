package com.brindix.orders;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TabRepository extends JpaRepository<Tab, Long> {

    Optional<Tab> findFirstByTableIdAndStatus(Long tableId, TabStatus status);

    List<Tab> findByVenueIdAndStatus(Long venueId, TabStatus status);
}
