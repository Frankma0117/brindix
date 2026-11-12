package com.brindix.tables;

import com.brindix.common.ApiException;
import com.brindix.common.Codes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TableService {

    private final BarTableRepository tables;
    private final com.brindix.orders.TabRepository tabs;
    private final com.brindix.audit.AuditService audit;

    public TableService(BarTableRepository tables, com.brindix.orders.TabRepository tabs, com.brindix.audit.AuditService audit) {
        this.tables = tables;
        this.tabs = tabs;
        this.audit = audit;
    }

    public record TableInput(String name, String zone, Integer seats, Integer sortOrder, Boolean active) {}

    public record TableView(Long id, String name, String code, String zone, int seats, int sortOrder, boolean active) {
        public static TableView of(BarTable t) {
            return new TableView(t.getId(), t.getName(), t.getCode(), t.getZone(), t.getSeats(), t.getSortOrder(), t.isActive());
        }
    }

    @Transactional(readOnly = true)
    public List<BarTable> list(Long venueId) {
        return tables.findByVenueIdOrderBySortOrderAscNameAsc(venueId).stream().filter(t -> !t.isArchived()).toList();
    }

    /** Mesa por el código del QR, comprobando que sea de ese bar. */
    @Transactional(readOnly = true)
    public BarTable byCode(Long venueId, String code) {
        return tables.findByCode(code == null ? "" : code.trim().toLowerCase())
                .filter(t -> t.isActive() && t.getVenueId().equals(venueId))
                .orElseThrow(() -> ApiException.notFound("Este código QR ya no es válido. Pide uno nuevo al mesero."));
    }

    @Transactional(readOnly = true)
    public BarTable owned(Long venueId, Long id) {
        return tables.findById(id).filter(t -> t.getVenueId().equals(venueId) && !t.isArchived())
                .orElseThrow(() -> ApiException.notFound("Mesa no encontrada"));
    }

    @Transactional
    public BarTable save(Long venueId, Long id, TableInput in) {
        if (in.name() == null || in.name().isBlank()) throw ApiException.badRequest("La mesa necesita un nombre");
        BarTable t = id == null ? new BarTable() : owned(venueId, id);
        t.setVenueId(venueId);
        t.setName(in.name().trim());
        t.setZone(in.zone() == null || in.zone().isBlank() ? null : in.zone().trim());
        t.setSeats(in.seats() == null ? 4 : Math.max(1, in.seats()));
        t.setSortOrder(in.sortOrder() == null ? 0 : in.sortOrder());
        t.setActive(in.active() == null || in.active());
        if (t.getCode() == null) t.setCode(newCode());
        return tables.save(t);
    }

    /** Eliminar: si tiene una cuenta abierta no se puede; si no, se archiva (su QR deja de servir y el historial queda). */
    @Transactional
    public void delete(com.brindix.security.StaffPrincipal me, Long id) {
        BarTable t = owned(me.venueId(), id);
        if (tabs.findFirstByTableIdAndStatus(t.getId(), com.brindix.orders.TabStatus.OPEN).isPresent()) {
            throw ApiException.conflict("La mesa tiene una cuenta abierta: cóbrala o pásala a otra mesa antes de eliminarla");
        }
        t.setArchived(true);
        t.setActive(false);
        t.setCode(newCode());
        audit.log(me, me.venueId(), "Eliminó una mesa", "table", t.getId(), t.getName());
    }

    /** Invalida el QR impreso anterior (por ejemplo si alguien lo fotografió y pide desde fuera). */
    @Transactional
    public BarTable regenerateCode(Long venueId, Long id) {
        BarTable t = owned(venueId, id);
        t.setCode(newCode());
        return t;
    }

    public String newCode() {
        String code;
        do {
            code = Codes.random(8);
        } while (tables.existsByCode(code));
        return code;
    }
}
