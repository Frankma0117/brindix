package com.brindix.bar;

import com.brindix.common.ApiException;
import com.brindix.orders.*;
import com.brindix.recipes.Ingredient;
import com.brindix.recipes.IngredientRepository;
import com.brindix.recipes.RecipeLineRepository;
import com.brindix.security.StaffPrincipal;
import com.brindix.tables.BarTable;
import com.brindix.tables.BarTableRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Cola de preparación de la barra: ítems de rondas confirmadas cuyo producto se prepara. */
@Service
public class BarService {

    private final RoundRepository rounds;
    private final RoundItemRepository items;
    private final TabRepository tabs;
    private final BarTableRepository tables;
    private final RecipeLineRepository recipeLines;
    private final IngredientRepository ingredients;

    public BarService(RoundRepository rounds, RoundItemRepository items, TabRepository tabs, BarTableRepository tables,
                      RecipeLineRepository recipeLines, IngredientRepository ingredients) {
        this.rounds = rounds;
        this.items = items;
        this.tabs = tabs;
        this.tables = tables;
        this.recipeLines = recipeLines;
        this.ingredients = ingredients;
    }

    @Transactional(readOnly = true)
    public BarDtos.Queue queue(Long venueId) {
        List<Round> inProgress = rounds.findInProgress(venueId); // ya viene de más antigua a más nueva
        Map<Long, Tab> tabById = tabs.findAllById(inProgress.stream().map(Round::getTabId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Tab::getId, Function.identity()));
        Map<Long, String> tableNames = tables.findAllById(tabById.values().stream().map(Tab::getTableId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(BarTable::getId, BarTable::getName));
        Map<Long, List<BarDtos.RecipeLine>> recipeCache = new HashMap<>();
        List<BarDtos.QueueItem> out = new ArrayList<>();
        for (Round r : inProgress) {
            Tab tab = tabById.get(r.getTabId());
            String table = tab == null ? "?" : tableNames.getOrDefault(tab.getTableId(), "?");
            for (RoundItem i : r.getItems()) {
                if (i.isVoided() || i.getPrepStatus() != PrepStatus.PENDING) continue;
                List<BarDtos.RecipeLine> recipe = recipeCache.computeIfAbsent(i.getProductId(), this::recipeOf);
                out.add(new BarDtos.QueueItem(i.getId(), r.getId(), r.getTabId(), table,
                        r.getConfirmedAt() != null ? r.getConfirmedAt() : r.getCreatedAt(), i.getQuantity(),
                        i.getProductName(), i.getNote(), recipe));
            }
        }
        return new BarDtos.Queue(out);
    }

    private List<BarDtos.RecipeLine> recipeOf(Long productId) {
        var lines = recipeLines.findByProductId(productId);
        if (lines.isEmpty()) return List.of();
        Map<Long, Ingredient> byId = ingredients.findAllById(lines.stream().map(l -> l.getIngredientId()).toList())
                .stream().collect(Collectors.toMap(Ingredient::getId, Function.identity()));
        return lines.stream().filter(l -> byId.containsKey(l.getIngredientId()))
                .map(l -> new BarDtos.RecipeLine(byId.get(l.getIngredientId()).getName(), byId.get(l.getIngredientId()).getUnit(), l.getQuantity()))
                .toList();
    }

    @Transactional
    public void markReady(StaffPrincipal me, Long itemId) {
        RoundItem i = owned(me.venueId(), itemId);
        if (i.getPrepStatus() == null) throw ApiException.badRequest("Este producto no se prepara en barra");
        i.setPrepStatus(PrepStatus.READY);
        i.setPreparedAt(Instant.now());
        i.setPreparedBy(me.id());
        items.save(i);
    }

    @Transactional
    public void undo(StaffPrincipal me, Long itemId) {
        RoundItem i = owned(me.venueId(), itemId);
        if (i.getPrepStatus() == null) throw ApiException.badRequest("Este producto no se prepara en barra");
        i.setPrepStatus(PrepStatus.PENDING);
        i.setPreparedAt(null);
        i.setPreparedBy(null);
        items.save(i);
    }

    private RoundItem owned(Long venueId, Long itemId) {
        RoundItem i = items.findById(itemId).orElseThrow(() -> ApiException.notFound("Ítem no encontrado"));
        Round r = i.getRound();
        Tab tab = tabs.findById(r.getTabId()).orElse(null);
        if (tab == null || !tab.getVenueId().equals(venueId)) throw ApiException.notFound("Ítem no encontrado");
        return i;
    }
}
