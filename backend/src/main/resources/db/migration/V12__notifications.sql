-- Panel de notificaciones del administrador.
CREATE TABLE notifications (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id   BIGINT       NOT NULL,
    type       VARCHAR(40)  NOT NULL,
    title      VARCHAR(160) NOT NULL,
    body       VARCHAR(400),
    link       VARCHAR(120),
    created_at DATETIME(6)  NOT NULL,
    read_at    DATETIME(6)  NULL,
    dedupe_key VARCHAR(120) NOT NULL,
    CONSTRAINT fk_notifications_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT uq_notifications_dedupe UNIQUE (venue_id, dedupe_key)
);
CREATE INDEX idx_notifications_venue ON notifications(venue_id, created_at);
