-- Videos de tutoriales y publicidad que el súper administrador crea desde el panel (los arma el estudio).
CREATE TABLE promo_videos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_by BIGINT NULL,
    kind VARCHAR(40) NOT NULL,
    kind_name VARCHAR(80) NULL,
    format VARCHAR(20) NOT NULL,
    voice VARCHAR(10) NOT NULL,
    music VARCHAR(20) NOT NULL,
    idea VARCHAR(600) NULL,
    status VARCHAR(20) NOT NULL,
    progress INT NOT NULL DEFAULT 0,
    detail VARCHAR(300) NULL,
    title VARCHAR(160) NULL,
    caption TEXT NULL,
    script TEXT NULL,
    video_url VARCHAR(500) NULL,
    poster_url VARCHAR(500) NULL,
    seconds DOUBLE NULL,
    created_at DATETIME(6) NOT NULL,
    finished_at DATETIME(6) NULL
);
CREATE INDEX idx_promo_videos_status ON promo_videos (status);
