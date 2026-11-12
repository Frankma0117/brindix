package com.brindix.tables;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BarTableRepository extends JpaRepository<BarTable, Long> {

    List<BarTable> findByVenueIdOrderBySortOrderAscNameAsc(Long venueId);

    Optional<BarTable> findByCode(String code);

    boolean existsByCode(String code);
}
