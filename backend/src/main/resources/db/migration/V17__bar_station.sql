-- Barra: productos que se preparan y estado de preparación por ítem de ronda.
ALTER TABLE products ADD COLUMN needs_prep BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE round_items ADD COLUMN prep_status VARCHAR(10) NULL;
ALTER TABLE round_items ADD COLUMN prepared_at DATETIME(6) NULL;
ALTER TABLE round_items ADD COLUMN prepared_by BIGINT NULL;
