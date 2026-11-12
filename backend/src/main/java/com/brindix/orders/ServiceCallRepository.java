package com.brindix.orders;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServiceCallRepository extends JpaRepository<ServiceCall, Long> {

    List<ServiceCall> findByVenueIdAndStatusOrderByCreatedAtAsc(Long venueId, CallStatus status);

    Optional<ServiceCall> findFirstByTableIdAndTypeAndStatus(Long tableId, CallType type, CallStatus status);

    List<ServiceCall> findByTableIdAndStatus(Long tableId, CallStatus status);
}
