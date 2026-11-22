-- Taller de video: guiones (spec JSON) que se graban con Remotion mediante el puente del host.
CREATE TABLE video_specs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    spec TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    detail VARCHAR(1500),
    url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
