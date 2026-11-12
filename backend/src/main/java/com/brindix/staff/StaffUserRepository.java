package com.brindix.staff;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StaffUserRepository extends JpaRepository<StaffUser, Long> {

    Optional<StaffUser> findByVenueIdAndUsernameIgnoreCase(Long venueId, String username);

    boolean existsByVenueIdAndUsernameIgnoreCase(Long venueId, String username);

    List<StaffUser> findByVenueIdOrderByNameAsc(Long venueId);

    List<StaffUser> findByVenueIdAndRoleOrderByIdAsc(Long venueId, Role role);

    long countByVenueIdAndRoleAndActiveTrue(Long venueId, Role role);

    long countByVenueId(Long venueId);

    List<StaffUser> findByVenueIdAndEmailIgnoreCaseAndActiveTrue(Long venueId, String email);
}
