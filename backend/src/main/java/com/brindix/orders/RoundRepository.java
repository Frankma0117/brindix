package com.brindix.orders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface RoundRepository extends JpaRepository<Round, Long> {

    List<Round> findByTabIdOrderByCreatedAtAsc(Long tabId);

    List<Round> findByTabIdIn(Collection<Long> tabIds);

    List<Round> findByPaymentIdIn(Collection<Long> paymentIds);

    @Query("select r from Round r where r.status = com.brindix.orders.RoundStatus.PENDING and r.tabId in (select t.id from Tab t where t.venueId = :venueId and t.status = com.brindix.orders.TabStatus.OPEN) order by r.createdAt asc")
    List<Round> findPending(Long venueId);

    /** Rondas en camino (confirmadas, sin entregar) de las cuentas abiertas. */
    @Query("select r from Round r where r.status = com.brindix.orders.RoundStatus.CONFIRMED and r.tabId in (select t.id from Tab t where t.venueId = :venueId and t.status = com.brindix.orders.TabStatus.OPEN) order by r.confirmedAt asc")
    List<Round> findInProgress(Long venueId);

    long countByTabIdAndStatus(Long tabId, RoundStatus status);
}
