-- El estudio envía cada video terminado al publicador de redes (bandeja «Por validar»); esta marca evita enviarlo dos veces.
ALTER TABLE promo_videos ADD COLUMN publisher_sent BOOLEAN NOT NULL DEFAULT FALSE;
