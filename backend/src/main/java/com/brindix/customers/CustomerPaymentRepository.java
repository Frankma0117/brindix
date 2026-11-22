package com.brindix.customers;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, Long> {

    List<CustomerPayment> findByVenueIdAndVoidedFalse(Long venueId);

    List<CustomerPayment> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
}
