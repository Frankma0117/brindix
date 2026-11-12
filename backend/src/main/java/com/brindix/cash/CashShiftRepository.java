package com.brindix.cash;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CashShiftRepository extends JpaRepository<CashShift, Long> {

    Optional<CashShift> findFirstByVenueIdAndStatus(Long venueId, CashShift.Status status);

    List<CashShift> findTop60ByVenueIdOrderByOpenedAtDesc(Long venueId);
}
