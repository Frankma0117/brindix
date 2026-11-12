package com.brindix.staff;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {

    List<PasswordReset> findByStatusInOrderByRequestedAtDesc(Collection<PasswordReset.Status> status);

    List<PasswordReset> findByVenueIdAndStatusInOrderByRequestedAtDesc(Long venueId, Collection<PasswordReset.Status> status);

    List<PasswordReset> findByUserIdAndStatusIn(Long userId, Collection<PasswordReset.Status> status);

    Optional<PasswordReset> findFirstByUserIdAndStatusOrderByApprovedAtDesc(Long userId, PasswordReset.Status status);
}
