// src/db/index.ts
// SQLite database — singleton + schema init + seed

import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('little_giant.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await initSchema(_db);
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      unit          TEXT NOT NULL,
      qty           REAL DEFAULT 0,
      max_qty       REAL DEFAULT 0,
      low_threshold REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      updated_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id           INTEGER PRIMARY KEY,
      name         TEXT NOT NULL,
      category_id  INTEGER,
      price        REAL NOT NULL,
      emoji        TEXT DEFAULT '🍽️',
      description  TEXT,
      is_available INTEGER DEFAULT 1,
      is_archived  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id            INTEGER PRIMARY KEY,
      menu_item_id  INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      qty_per_order REAL NOT NULL,
      UNIQUE(menu_item_id, ingredient_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number   TEXT NOT NULL UNIQUE,
      status         TEXT DEFAULT 'completed',
      payment_method TEXT DEFAULT 'cash',
      subtotal       REAL NOT NULL DEFAULT 0,
      discount       REAL DEFAULT 0,
      total          REAL NOT NULL DEFAULT 0,
      cashier_name   TEXT,
      notes          TEXT,
      created_at     TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      name         TEXT NOT NULL,
      price        REAL NOT NULL,
      qty          INTEGER NOT NULL DEFAULT 1,
      subtotal     REAL NOT NULL,
      notes        TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      type          TEXT NOT NULL,
      qty_change    REAL NOT NULL,
      qty_before    REAL NOT NULL,
      qty_after     REAL NOT NULL,
      reference_id  INTEGER,
      note          TEXT,
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed only if empty
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM categories');
  if (count && count.c === 0) {
    await seedData(db);
  }
}

async function seedData(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    INSERT INTO settings (key, value) VALUES
      ('store_name', 'Little Giant Food Stall'),
      ('currency', 'PHP');

    INSERT INTO categories (id, name, sort_order) VALUES
      (1, 'Silog Meals', 1),
      (2, 'BBQ & Grilled', 2),
      (3, 'Snacks', 3),
      (4, 'Drinks', 4);

    INSERT INTO ingredients (id, name, unit, qty, max_qty, low_threshold, cost_per_unit) VALUES
      (1,  'Rice',               'cups',    50,   80,   10, 2.50),
      (2,  'Egg',                'pieces',  48,   60,   10, 7.00),
      (3,  'Beef (tapsilog)',    'grams',   1200, 2000, 300, 0.80),
      (4,  'Longganisa',        'pieces',  20,   30,   5,  12.00),
      (5,  'Tocino',            'grams',   800,  1500, 200, 0.70),
      (6,  'Bangus',            'pieces',  10,   20,   3,  35.00),
      (7,  'Chicken BBQ',       'sticks',  30,   50,   8,  25.00),
      (8,  'Pork BBQ',          'sticks',  25,   50,   8,  20.00),
      (9,  'Isaw',              'sticks',  60,   100,  15, 5.00),
      (10, 'BBQ Sauce',         'cups',    15,   20,   3,  8.00),
      (11, 'Fishball',          'pieces',  80,   150,  20, 1.50),
      (12, 'Kwek-kwek eggs',    'pieces',  40,   80,   10, 4.00),
      (13, 'Batter mix',        'cups',    10,   15,   2,  5.00),
      (14, 'Fishball sauce',    'cups',    12,   20,   3,  6.00),
      (15, 'Sago',              'cups',    20,   30,   5,  8.00),
      (16, 'Gulaman',           'cups',    20,   30,   5,  6.00),
      (17, 'Brown sugar syrup', 'cups',    15,   25,   4,  10.00),
      (18, 'Softdrinks (can)',  'cans',    24,   48,   6,  22.00),
      (19, 'Mineral water',     'bottles', 24,   48,   6,  12.00);

    INSERT INTO menu_items (id, name, category_id, price, emoji) VALUES
      (1,  'Tapsilog',      1, 89,  '🍳'),
      (2,  'Longsilog',     1, 79,  '🌭'),
      (3,  'Tocilog',       1, 79,  '🥩'),
      (4,  'Bangsilog',     1, 95,  '🐟'),
      (5,  'Chicken BBQ',   2, 75,  '🍗'),
      (6,  'Pork BBQ',      2, 65,  '🥩'),
      (7,  'Isaw',          2, 35,  '🍢'),
      (8,  'Kwek-kwek',     3, 25,  '🟠'),
      (9,  'Fishball',      3, 20,  '⚪'),
      (10, 'Sagot Gulaman', 4, 25,  '🧉'),
      (11, 'Softdrinks',    4, 30,  '🥤'),
      (12, 'Mineral Water', 4, 20,  '💧');

    INSERT INTO recipes (menu_item_id, ingredient_id, qty_per_order) VALUES
      (1,1,1),(1,2,1),(1,3,150),
      (2,1,1),(2,2,1),(2,4,2),
      (3,1,1),(3,2,1),(3,5,100),
      (4,1,1),(4,2,1),(4,6,1),
      (5,7,1),(5,10,0.5),
      (6,8,1),(6,10,0.5),
      (7,9,3),
      (8,12,3),(8,13,0.5),
      (9,11,5),(9,14,0.5),
      (10,15,1),(10,16,1),(10,17,1),
      (11,18,1),
      (12,19,1);
  `);
}
