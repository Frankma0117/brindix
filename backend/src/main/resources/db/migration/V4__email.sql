-- Correo para recuperar la contraseña y recibir avisos de seguridad.
ALTER TABLE staff_users ADD COLUMN email VARCHAR(160) NULL;
ALTER TABLE platform_users ADD COLUMN email VARCHAR(160) NULL;

-- Código de recuperación del súper administrador (llega a su correo; se guarda solo el SHA-256).
ALTER TABLE platform_users ADD COLUMN reset_code_hash VARCHAR(64) NULL;
ALTER TABLE platform_users ADD COLUMN reset_expires_at DATETIME(6) NULL;
ALTER TABLE platform_users ADD COLUMN reset_attempts INT NOT NULL DEFAULT 0;
