package com.brindix.recipes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    List<Ingredient> findByVenueIdAndArchivedFalseOrderByNameAsc(Long venueId);

    boolean existsByVenueIdAndNameIgnoreCase(Long venueId, String name);
}
