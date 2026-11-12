-- Contraseñas iniciales o puestas por otra persona: se piden cambiar al entrar.
ALTER TABLE staff_users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE platform_users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Las cuentas que ya existen tienen claves generadas por el sistema.
UPDATE staff_users SET must_change_password = TRUE;
UPDATE platform_users SET must_change_password = TRUE;
