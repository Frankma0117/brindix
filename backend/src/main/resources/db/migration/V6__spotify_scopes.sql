-- Permisos que dio la cuenta de Spotify del bar ("streaming" = puede sonar en la pantalla del TV).
ALTER TABLE venues ADD COLUMN spotify_scopes VARCHAR(500) NULL;
