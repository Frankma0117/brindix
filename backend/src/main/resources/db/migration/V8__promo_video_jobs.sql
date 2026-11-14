-- Un pedido del estudio puede traer varios formatos (vertical, horizontal, cuadrado): todos comparten job_id.
ALTER TABLE promo_videos ADD COLUMN job_id VARCHAR(40) NULL;
UPDATE promo_videos SET job_id = CAST(id AS CHAR) WHERE job_id IS NULL;
CREATE INDEX idx_promo_videos_job ON promo_videos (job_id);
