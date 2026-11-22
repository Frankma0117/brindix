package com.brindix.recipes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecipeLineRepository extends JpaRepository<RecipeLine, Long> {

    List<RecipeLine> findByProductId(Long productId);

    void deleteByProductId(Long productId);

    void deleteByIngredientId(Long ingredientId);
}
