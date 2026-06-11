-- Little Giant POS — Database Schema
-- PostgreSQL

-- ─────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INGREDIENTS (raw stocks)
-- ─────────────────────────────────────────
CREATE TABLE ingredients (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    unit        VARCHAR(50)  NOT NULL,   -- cups, grams, pieces, ml, sticks
    qty         NUMERIC(10,2) DEFAULT 0,
    max_qty     NUMERIC(10,2) DEFAULT 0, -- for progress bar calculation
    low_threshold NUMERIC(10,2) DEFAULT 0, -- alert when qty <= this
    cost_per_unit NUMERIC(10,2) DEFAULT 0, -- for COGS calculation
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MENU ITEMS
-- ─────────────────────────────────────────
CREATE TABLE menu_items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    price       NUMERIC(10,2) NOT NULL,
    emoji       VARCHAR(10) DEFAULT '🍽️',
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    is_archived  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- RECIPE (menu item → ingredients)
-- ─────────────────────────────────────────
CREATE TABLE recipes (
    id            SERIAL PRIMARY KEY,
    menu_item_id  INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    qty_per_order NUMERIC(10,3) NOT NULL, -- how much ingredient used per 1 order
    UNIQUE(menu_item_id, ingredient_id)
);

-- ─────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────
CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(20) NOT NULL UNIQUE, -- e.g. LG-001
    status          VARCHAR(30) DEFAULT 'completed', -- pending, completed, voided
    payment_method  VARCHAR(30) DEFAULT 'cash', -- cash, gcash, maya
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount        NUMERIC(10,2) DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    cashier_name    VARCHAR(100),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ORDER ITEMS
-- ─────────────────────────────────────────
CREATE TABLE order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INT NOT NULL REFERENCES menu_items(id),
    name         VARCHAR(150) NOT NULL, -- snapshot name at time of sale
    price        NUMERIC(10,2) NOT NULL, -- snapshot price at time of sale
    qty          INT NOT NULL DEFAULT 1,
    subtotal     NUMERIC(10,2) NOT NULL,
    notes        TEXT
);

-- ─────────────────────────────────────────
-- STOCK MOVEMENTS (audit trail)
-- ─────────────────────────────────────────
CREATE TABLE stock_movements (
    id            SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id),
    type          VARCHAR(30) NOT NULL, -- restock, sale_deduction, waste, adjustment
    qty_change    NUMERIC(10,2) NOT NULL, -- positive = added, negative = removed
    qty_before    NUMERIC(10,2) NOT NULL,
    qty_after     NUMERIC(10,2) NOT NULL,
    reference_id  INT,    -- order_id if type = sale_deduction
    note          TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- WASTE LOG
-- ─────────────────────────────────────────
CREATE TABLE waste_logs (
    id            SERIAL PRIMARY KEY,
    ingredient_id INT NOT NULL REFERENCES ingredients(id),
    qty           NUMERIC(10,2) NOT NULL,
    reason        TEXT,
    logged_by     VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SETTINGS
-- ─────────────────────────────────────────
CREATE TABLE settings (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX idx_stock_movements_ingredient_id ON stock_movements(ingredient_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_recipes_menu_item_id ON recipes(menu_item_id);

-- ─────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
    ('store_name', 'Little Giant Food Stall'),
    ('currency', 'PHP'),
    ('low_stock_alert', 'true'),
    ('ai_language', 'mixed'); -- mixed = Taglish

INSERT INTO categories (name, sort_order) VALUES
    ('Silog Meals', 1),
    ('BBQ & Grilled', 2),
    ('Snacks', 3),
    ('Drinks', 4);

INSERT INTO ingredients (name, unit, qty, max_qty, low_threshold, cost_per_unit) VALUES
    ('Rice', 'cups', 50, 80, 10, 2.50),
    ('Egg', 'pieces', 48, 60, 10, 7.00),
    ('Beef (tapsilog)', 'grams', 1200, 2000, 300, 0.80),
    ('Longganisa', 'pieces', 20, 30, 5, 12.00),
    ('Tocino', 'grams', 800, 1500, 200, 0.70),
    ('Bangus', 'pieces', 10, 20, 3, 35.00),
    ('Chicken BBQ', 'sticks', 30, 50, 8, 25.00),
    ('Pork BBQ', 'sticks', 25, 50, 8, 20.00),
    ('Isaw', 'sticks', 60, 100, 15, 5.00),
    ('BBQ Sauce', 'cups', 15, 20, 3, 8.00),
    ('Fishball', 'pieces', 80, 150, 20, 1.50),
    ('Kwek-kwek (quail eggs)', 'pieces', 40, 80, 10, 4.00),
    ('Batter mix', 'cups', 10, 15, 2, 5.00),
    ('Fishball sauce', 'cups', 12, 20, 3, 6.00),
    ('Sago', 'cups', 20, 30, 5, 8.00),
    ('Gulaman', 'cups', 20, 30, 5, 6.00),
    ('Brown sugar syrup', 'cups', 15, 25, 4, 10.00),
    ('Softdrinks (can)', 'cans', 24, 48, 6, 22.00),
    ('Mineral water', 'bottles', 24, 48, 6, 12.00);

INSERT INTO menu_items (name, category_id, price, emoji) VALUES
    ('Tapsilog', 1, 89, '🍳'),
    ('Longsilog', 1, 79, '🌭'),
    ('Tocilog', 1, 79, '🥩'),
    ('Bangsilog', 1, 95, '🐟'),
    ('Chicken BBQ', 2, 75, '🍗'),
    ('Pork BBQ', 2, 65, '🥩'),
    ('Isaw', 2, 35, '🍢'),
    ('Kwek-kwek', 3, 25, '🟠'),
    ('Fishball', 3, 20, '⚪'),
    ('Sago''t Gulaman', 4, 25, '🧉'),
    ('Softdrinks', 4, 30, '🥤'),
    ('Mineral Water', 4, 20, '💧');

-- Recipes (qty_per_order)
INSERT INTO recipes (menu_item_id, ingredient_id, qty_per_order) VALUES
    (1, 1, 1), (1, 2, 1), (1, 3, 150),   -- Tapsilog: 1 rice, 1 egg, 150g beef
    (2, 1, 1), (2, 2, 1), (2, 4, 2),     -- Longsilog: 1 rice, 1 egg, 2 longganisa
    (3, 1, 1), (3, 2, 1), (3, 5, 100),   -- Tocilog: 1 rice, 1 egg, 100g tocino
    (4, 1, 1), (4, 2, 1), (4, 6, 1),     -- Bangsilog: 1 rice, 1 egg, 1 bangus
    (5, 7, 1), (5, 10, 0.5),             -- Chicken BBQ: 1 stick, 0.5 cup sauce
    (6, 8, 1), (6, 10, 0.5),             -- Pork BBQ: 1 stick, 0.5 cup sauce
    (7, 9, 3),                            -- Isaw: 3 sticks
    (8, 12, 3), (8, 13, 0.5),            -- Kwek-kwek: 3 eggs, 0.5 cup batter
    (9, 11, 5), (9, 14, 0.5),            -- Fishball: 5 pieces, 0.5 cup sauce
    (10, 15, 1), (10, 16, 1), (10, 17, 1), -- Sago't Gulaman
    (11, 18, 1),                          -- Softdrinks: 1 can
    (12, 19, 1);                          -- Water: 1 bottle
