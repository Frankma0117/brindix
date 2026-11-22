-- Recetas e insumos: productos que consumen insumos al venderse (coctel = 2 shots de ron + 30 ml de jugo...).
CREATE TABLE ingredients (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id   BIGINT         NOT NULL,
    name       VARCHAR(120)   NOT NULL,
    unit       VARCHAR(10)    NOT NULL,
    stock      DECIMAL(14,3)  NOT NULL,
    min_stock  DECIMAL(14,3)  NULL,
    avg_cost   DECIMAL(14,4)  NOT NULL,
    archived   BOOLEAN        NOT NULL,
    created_at DATETIME(6)    NOT NULL,
    CONSTRAINT fk_ingredients_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
    CONSTRAINT uq_ingredients_name UNIQUE (venue_id, name)
);

CREATE TABLE ingredient_movements (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id      BIGINT         NOT NULL,
    ingredient_id BIGINT         NOT NULL,
    type          VARCHAR(20)    NOT NULL,                -- ENTRY | SALE | ADJUST | WASTE | SALE_VOID
    quantity      DECIMAL(14,3)  NOT NULL,                -- con signo
    stock_after   DECIMAL(14,3)  NOT NULL,
    unit_cost     DECIMAL(14,4)  NULL,
    note          VARCHAR(300),
    tab_id        BIGINT,
    user_id       BIGINT,
    created_at    DATETIME(6)    NOT NULL,
    CONSTRAINT fk_ingmov_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);
CREATE INDEX idx_ingmov_ingredient ON ingredient_movements(ingredient_id, created_at);
CREATE INDEX idx_ingmov_venue ON ingredient_movements(venue_id, created_at);

CREATE TABLE recipe_lines (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id    BIGINT         NOT NULL,
    ingredient_id BIGINT         NOT NULL,
    quantity      DECIMAL(14,3)  NOT NULL,
    CONSTRAINT fk_recipe_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_recipe_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
    CONSTRAINT uq_recipe_line UNIQUE (product_id, ingredient_id)
);
