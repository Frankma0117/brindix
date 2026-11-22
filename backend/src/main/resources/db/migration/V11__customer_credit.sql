-- Fiado: clientes con deuda. Un cobro con método CREDIT apunta al cliente; los abonos van aparte.
CREATE TABLE customers (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id   BIGINT       NOT NULL,
    name       VARCHAR(120) NOT NULL,
    phone      VARCHAR(40),
    note       VARCHAR(300),
    archived   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at DATETIME(6)  NOT NULL,
    CONSTRAINT fk_customers_venue FOREIGN KEY (venue_id) REFERENCES venues(id)
);
CREATE INDEX idx_customers_venue ON customers(venue_id, archived);

-- payments.method es VARCHAR(20): admite CREDIT sin cambios.
ALTER TABLE payments ADD COLUMN customer_id BIGINT NULL;
ALTER TABLE payments ADD CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
CREATE INDEX idx_payments_customer ON payments(customer_id);

CREATE TABLE customer_payments (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    venue_id         BIGINT        NOT NULL,
    customer_id      BIGINT        NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    method           VARCHAR(20)   NOT NULL,
    note             VARCHAR(300),
    shift_id         BIGINT NULL,
    cash_movement_id BIGINT NULL,
    created_by       BIGINT        NOT NULL,
    created_at       DATETIME(6)   NOT NULL,
    voided           BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_custpay_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_custpay_shift FOREIGN KEY (shift_id) REFERENCES cash_shifts(id)
);
CREATE INDEX idx_custpay_customer ON customer_payments(customer_id);
