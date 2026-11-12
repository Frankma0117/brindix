-- «Eliminar» mesas y usuarios sin perder el historial: quedan archivados (no se listan) y sus ventas siguen en los reportes.
ALTER TABLE bar_tables ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff_users ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
