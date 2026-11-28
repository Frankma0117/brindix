-- La voz fija es eleven2:Chris (13 letras) y la guia en PDF no lleva voz ni musica.
ALTER TABLE promo_videos MODIFY voice VARCHAR(40) NULL;
ALTER TABLE promo_videos MODIFY music VARCHAR(20) NULL;
