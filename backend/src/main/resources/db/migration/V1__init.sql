-- Brindix: esquema inicial para MySQL 8 (y H2 en modo MySQL para desarrollo).
-- Plataforma multi-bar: todo cuelga de venues. Las fechas se guardan en UTC.

CREATE TABLE platform_users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    username        VARCHAR(60)  NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    active          BOOLEAN      NOT NULL,
    created_at      DATETIME(6)  NOT NULL,
    last_login_at   DATETIME(6),
    CONSTRAINT uq_platform_users_username UNIQUE (username)
);

CREATE TABLE venues (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    name                    VARCHAR(120) NOT NULL,
    slug                    VARCHAR(60)  NOT NULL,
    tagline                 VARCHAR(200),
    logo_url                VARCHAR(500),
    currency                VARCHAR(8)   NOT NULL,
    wifi_name               VARCHAR(80),
    wifi_password           VARCHAR(80),
    active                  BOOLEAN      NOT NULL,
    contact_name            VARCHAR(120),
    contact_phone           VARCHAR(40),
    -- Pedidos y cobros
    client_orders_enabled   BOOLEAN      NOT NULL,
    waiter_can_charge       BOOLEAN      NOT NULL,
    -- Música
    music_enabled           BOOLEAN      NOT NULL,
    song_approval           BOOLEAN      NOT NULL,
    max_songs_per_table     INT          NOT NULL,
    music_provider          VARCHAR(20)  NOT NULL,     -- MANUAL | SPOTIFY | YOUTUBE
    spotify_client_id       VARCHAR(120),
    spotify_client_secret   VARCHAR(400),              -- cifrado
    spotify_access_token    VARCHAR(1200),             -- cifrado
    spotify_refresh_token   VARCHAR(1200),             -- cifrado
    spotify_expires_at      DATETIME(6),
    spotify_account         VARCHAR(120),
    youtube_api_key         VARCHAR(400),              -- cifrado
    screen_key              VARCHAR(40)  NOT NULL,     -- da control del reproductor a la pantalla del bar
    created_at              DATETIME(6)  NOT NULL,
    CONSTRAINT uq_venues_slug UNIQUE (slug)
);

CREATE TABLE staff_users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id        BIGINT       NOT NULL,
    name            VARCHAR(120) NOT NULL,
    username        VARCHAR(60)  NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL,             -- ADMIN | WAITER
    active          BOOLEAN      NOT NULL,
    created_at      DATETIME(6)  NOT NULL,
    last_login_at   DATETIME(6),
    CONSTRAINT uq_staff_venue_username UNIQUE (venue_id, username),
    CONSTRAINT fk_staff_venue FOREIGN KEY (venue_id) REFERENCES venues(id)
);

CREATE TABLE categories (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id    BIGINT       NOT NULL,
    name        VARCHAR(80)  NOT NULL,
    icon        VARCHAR(16),
    art         VARCHAR(30),
    sort_order  INT          NOT NULL,
    active      BOOLEAN      NOT NULL,
    CONSTRAINT fk_categories_venue FOREIGN KEY (venue_id) REFERENCES venues(id)
);

CREATE TABLE products (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id     BIGINT        NOT NULL,
    category_id  BIGINT        NOT NULL,
    name         VARCHAR(120)  NOT NULL,
    description  VARCHAR(600),
    price        DECIMAL(12,2) NOT NULL,               -- a cómo se vende
    cost         DECIMAL(12,2),                        -- a cómo se compra (promedio ponderado)
    image_url    VARCHAR(500),
    unit         VARCHAR(20)   NOT NULL,
    track_stock  BOOLEAN       NOT NULL,
    stock        INT           NOT NULL,
    min_stock    INT           NOT NULL,
    available    BOOLEAN       NOT NULL,
    featured     BOOLEAN       NOT NULL,
    tags         VARCHAR(200),
    sort_order   INT           NOT NULL,
    archived     BOOLEAN       NOT NULL,
    created_at   DATETIME(6)   NOT NULL,
    updated_at   DATETIME(6)   NOT NULL,
    CONSTRAINT fk_products_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX idx_products_venue ON products(venue_id, category_id);

CREATE TABLE bar_tables (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id    BIGINT       NOT NULL,
    name        VARCHAR(60)  NOT NULL,
    code        VARCHAR(40)  NOT NULL,
    zone        VARCHAR(60),
    seats       INT          NOT NULL,
    sort_order  INT          NOT NULL,
    active      BOOLEAN      NOT NULL,
    CONSTRAINT uq_tables_code UNIQUE (code),
    CONSTRAINT fk_tables_venue FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Caja: un turno se abre con la base y se cierra contando el dinero.
CREATE TABLE cash_shifts (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id        BIGINT        NOT NULL,
    status          VARCHAR(20)   NOT NULL,            -- OPEN | CLOSED
    opened_by       BIGINT        NOT NULL,
    opened_at       DATETIME(6)   NOT NULL,
    opening_cash    DECIMAL(12,2) NOT NULL,
    opening_note    VARCHAR(300),
    closed_by       BIGINT,
    closed_at       DATETIME(6),
    expected_cash   DECIMAL(12,2),
    counted_cash    DECIMAL(12,2),
    difference      DECIMAL(12,2),
    closing_note    VARCHAR(500),
    CONSTRAINT fk_shifts_venue FOREIGN KEY (venue_id) REFERENCES venues(id)
);
CREATE INDEX idx_shifts_venue ON cash_shifts(venue_id, status);

CREATE TABLE cash_movements (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id    BIGINT        NOT NULL,
    shift_id    BIGINT        NOT NULL,
    direction   VARCHAR(10)   NOT NULL,                -- IN | OUT
    category    VARCHAR(30)   NOT NULL,                -- BILL | RESTOCK | WITHDRAWAL | DEPOSIT | TIP_PAYOUT | SALARY | OTHER
    method      VARCHAR(20)   NOT NULL,                -- CASH | TRANSFER | ...
    amount      DECIMAL(12,2) NOT NULL,
    description VARCHAR(300)  NOT NULL,
    created_by  BIGINT        NOT NULL,
    created_at  DATETIME(6)   NOT NULL,
    CONSTRAINT fk_cashmov_shift FOREIGN KEY (shift_id) REFERENCES cash_shifts(id)
);
CREATE INDEX idx_cashmov_shift ON cash_movements(shift_id);

CREATE TABLE tabs (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id        BIGINT        NOT NULL,
    table_id        BIGINT        NOT NULL,
    status          VARCHAR(20)   NOT NULL,            -- OPEN | CLOSED | CANCELLED
    customer_name   VARCHAR(120),
    notes           VARCHAR(500),
    waiter_id       BIGINT,                            -- mesero responsable
    opened_by       BIGINT,
    closed_by       BIGINT,
    opened_at       DATETIME(6)   NOT NULL,
    closed_at       DATETIME(6),
    CONSTRAINT fk_tabs_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT fk_tabs_table FOREIGN KEY (table_id) REFERENCES bar_tables(id)
);
CREATE INDEX idx_tabs_table_status ON tabs(table_id, status);
CREATE INDEX idx_tabs_venue_status ON tabs(venue_id, status);

-- Un cobro: puede pagar una o varias rondas (por ronda o todo junto).
CREATE TABLE payments (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id      BIGINT        NOT NULL,
    tab_id        BIGINT        NOT NULL,
    shift_id      BIGINT        NOT NULL,
    subtotal      DECIMAL(12,2) NOT NULL,
    discount      DECIMAL(12,2) NOT NULL,
    tip           DECIMAL(12,2) NOT NULL,
    total         DECIMAL(12,2) NOT NULL,
    method        VARCHAR(20)   NOT NULL,
    note          VARCHAR(300),
    collected_by  BIGINT        NOT NULL,
    collected_at  DATETIME(6)   NOT NULL,
    settled       BOOLEAN       NOT NULL,              -- false = lo tiene el mesero, falta entregarlo en caja
    settled_by    BIGINT,
    settled_at    DATETIME(6),
    voided        BOOLEAN       NOT NULL,
    void_reason   VARCHAR(200),
    CONSTRAINT fk_payments_tab FOREIGN KEY (tab_id) REFERENCES tabs(id),
    CONSTRAINT fk_payments_shift FOREIGN KEY (shift_id) REFERENCES cash_shifts(id)
);
CREATE INDEX idx_payments_shift ON payments(shift_id);
CREATE INDEX idx_payments_venue ON payments(venue_id, collected_at);

CREATE TABLE rounds (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    tab_id        BIGINT       NOT NULL,
    source        VARCHAR(20)  NOT NULL,               -- WAITER | CLIENT | ADMIN
    status        VARCHAR(20)  NOT NULL,               -- PENDING | CONFIRMED | DELIVERED | REJECTED
    created_by    BIGINT,
    assigned_to   BIGINT,                              -- mesero que lo lleva
    handled_by    BIGINT,
    payment_id    BIGINT,
    client_name   VARCHAR(80),
    note          VARCHAR(300),
    reject_reason VARCHAR(200),
    created_at    DATETIME(6)  NOT NULL,
    confirmed_at  DATETIME(6),
    delivered_at  DATETIME(6),
    CONSTRAINT fk_rounds_tab FOREIGN KEY (tab_id) REFERENCES tabs(id),
    CONSTRAINT fk_rounds_payment FOREIGN KEY (payment_id) REFERENCES payments(id)
);
CREATE INDEX idx_rounds_tab ON rounds(tab_id);
CREATE INDEX idx_rounds_status ON rounds(status);

CREATE TABLE round_items (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    round_id      BIGINT        NOT NULL,
    product_id    BIGINT        NOT NULL,
    product_name  VARCHAR(120)  NOT NULL,
    unit_price    DECIMAL(12,2) NOT NULL,
    unit_cost     DECIMAL(12,2),                       -- costo al momento de la venta (para la ganancia)
    quantity      INT           NOT NULL,
    note          VARCHAR(200),
    voided        BOOLEAN       NOT NULL,
    void_reason   VARCHAR(200),
    CONSTRAINT fk_items_round FOREIGN KEY (round_id) REFERENCES rounds(id),
    CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX idx_round_items_round ON round_items(round_id);

CREATE TABLE stock_movements (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id    BIGINT        NOT NULL,
    product_id  BIGINT        NOT NULL,
    type        VARCHAR(20)   NOT NULL,                -- ENTRY | SALE | RETURN | ADJUSTMENT | WASTE
    quantity    INT           NOT NULL,
    stock_after INT           NOT NULL,
    unit_cost   DECIMAL(12,2),
    supplier    VARCHAR(120),
    reference   VARCHAR(120),
    note        VARCHAR(300),
    user_id     BIGINT,
    tab_id      BIGINT,
    created_at  DATETIME(6)   NOT NULL,
    CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX idx_stock_mov_product ON stock_movements(product_id, created_at);
CREATE INDEX idx_stock_mov_venue ON stock_movements(venue_id, created_at);

CREATE TABLE song_requests (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id         BIGINT        NOT NULL,
    table_id         BIGINT,
    provider         VARCHAR(20)   NOT NULL,           -- MANUAL | SPOTIFY | YOUTUBE
    track_ref        VARCHAR(200),                     -- uri de Spotify o id del video de YouTube
    title            VARCHAR(200)  NOT NULL,
    artist           VARCHAR(200),
    album_image      VARCHAR(500),
    duration_ms      INT,
    requested_by     VARCHAR(80),
    status           VARCHAR(20)   NOT NULL,           -- PENDING | QUEUED | PLAYING | PLAYED | REJECTED
    position         BIGINT        NOT NULL,
    pinned           BOOLEAN       NOT NULL,
    sent_to_player   BOOLEAN       NOT NULL,
    created_at       DATETIME(6)   NOT NULL,
    started_at       DATETIME(6),
    finished_at      DATETIME(6)
);
CREATE INDEX idx_songs_venue_status ON song_requests(venue_id, status, position);

CREATE TABLE banners (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id          BIGINT       NOT NULL,
    title             VARCHAR(120) NOT NULL,
    subtitle          VARCHAR(300),
    image_url         VARCHAR(500),
    theme             VARCHAR(30)  NOT NULL,
    duration_seconds  INT          NOT NULL,
    sort_order        INT          NOT NULL,
    active            BOOLEAN      NOT NULL,
    starts_at         DATETIME(6),
    ends_at           DATETIME(6),
    product_id        BIGINT,
    created_at        DATETIME(6)  NOT NULL
);

CREATE TABLE service_calls (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id    BIGINT       NOT NULL,
    table_id    BIGINT       NOT NULL,
    type        VARCHAR(20)  NOT NULL,                 -- WAITER | BILL
    status      VARCHAR(20)  NOT NULL,                 -- OPEN | DONE
    created_at  DATETIME(6)  NOT NULL,
    done_at     DATETIME(6),
    done_by     BIGINT
);
CREATE INDEX idx_calls_venue_status ON service_calls(venue_id, status);

-- Bitácora: quién cambió qué (pedidos, cobros, caja, inventario).
CREATE TABLE audit_log (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id    BIGINT        NOT NULL,
    user_id     BIGINT,
    user_name   VARCHAR(120),
    action      VARCHAR(60)   NOT NULL,
    entity      VARCHAR(40)   NOT NULL,
    entity_id   BIGINT,
    details     VARCHAR(1000),
    created_at  DATETIME(6)   NOT NULL
);
CREATE INDEX idx_audit_venue ON audit_log(venue_id, created_at);
