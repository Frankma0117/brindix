package com.brindix.recipes;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IngredientMovementRepository extends JpaRepository<IngredientMovement, Long> {

    List<IngredientMovement> findByIngredientIdOrderByCreatedAtDescIdDesc(Long ingredientId, Pageable page);
}
