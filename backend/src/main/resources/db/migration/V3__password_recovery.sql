-- Versión de sesión: cambia al cambiar o restablecer la contraseña y cierra las sesiones abiertas.
ALTER TABLE staff_users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
ALTER TABLE platform_users ADD COLUMN token_version INT NOT NULL DEFAULT 0;

-- Solicitudes de recuperación de contraseña del personal de un bar.
-- Las aprueba otro administrador del bar o el súper administrador; el código de un solo uso se guarda cifrado.
CREATE TABLE password_resets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  venue_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NULL,
  attempts INT NOT NULL DEFAULT 0,
  requested_at DATETIME(6) NOT NULL,
  requested_ip VARCHAR(64) NULL,
  approved_by VARCHAR(160) NULL,
  approved_at DATETIME(6) NULL,
  expires_at DATETIME(6) NULL,
  closed_at DATETIME(6) NULL,
  CONSTRAINT fk_pr_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES staff_users(id)
);
CREATE INDEX idx_pr_venue_status ON password_resets (venue_id, status);
CREATE INDEX idx_pr_user ON password_resets (user_id, status);
