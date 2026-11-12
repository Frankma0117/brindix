package com.brindix.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByVenueIdAndArchivedFalseOrderBySortOrderAscNameAsc(Long venueId);

    long countByCategoryIdAndArchivedFalse(Long categoryId);

    @Query("select p from Product p where p.venueId = :venueId and p.archived = false and p.trackStock = true and p.stock <= p.minStock order by p.stock asc")
    List<Product> findLowStock(Long venueId);
}
