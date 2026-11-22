package com.brindix.recipes;

import com.brindix.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Solo ADMIN (SecurityConfig protege /api/admin/**). */
@RestController
@RequestMapping("/api/admin")
public class IngredientController {

    private final IngredientService service;

    public IngredientController(IngredientService service) {
        this.service = service;
    }

    @GetMapping("/ingredients")
    public List<RecipeDtos.IngredientView> list() {
        return service.list(CurrentUser.venueId());
    }

    @PostMapping("/ingredients")
    public RecipeDtos.IngredientView create(@Valid @RequestBody RecipeDtos.IngredientInput in) {
        return service.create(CurrentUser.get(), in);
    }

    @PutMapping("/ingredients/{id}")
    public RecipeDtos.IngredientView update(@PathVariable Long id, @Valid @RequestBody RecipeDtos.IngredientInput in) {
        return service.update(CurrentUser.get(), id, in);
    }

    @DeleteMapping("/ingredients/{id}")
    public void archive(@PathVariable Long id) {
        service.archive(CurrentUser.get(), id);
    }

    @PostMapping("/ingredients/{id}/movements")
    public RecipeDtos.IngredientView movement(@PathVariable Long id, @Valid @RequestBody RecipeDtos.MovementInput in) {
        return service.addMovement(CurrentUser.get(), id, in);
    }

    @GetMapping("/ingredients/{id}/movements")
    public List<RecipeDtos.MovementView> history(@PathVariable Long id, @RequestParam(defaultValue = "100") int limit) {
        return service.history(CurrentUser.venueId(), id, limit);
    }

    @GetMapping("/products/{id}/recipe")
    public RecipeDtos.RecipeView recipe(@PathVariable Long id) {
        return service.recipe(CurrentUser.venueId(), id);
    }

    @PutMapping("/products/{id}/recipe")
    public RecipeDtos.RecipeView saveRecipe(@PathVariable Long id, @Valid @RequestBody RecipeDtos.RecipeInput in) {
        return service.saveRecipe(CurrentUser.get(), id, in);
    }
}
