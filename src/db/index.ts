// src/db/index.ts — v3: per-item stock, full menu seed
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
const DB_VERSION = 3;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('little_giant.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(_db);
  return _db;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      emoji      TEXT DEFAULT '🍽️',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      category_id  INTEGER,
      price        REAL NOT NULL,
      emoji        TEXT DEFAULT '🍽️',
      is_available INTEGER DEFAULT 1,
      is_archived  INTEGER DEFAULT 0,
      stock        INTEGER DEFAULT 1
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

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM _meta WHERE key = 'version'`);
  const version = row ? parseInt(row.value) : 0;

  if (version < DB_VERSION) {
    // Clear and reseed menu/categories only — keep orders
    await db.execAsync(`
      DELETE FROM categories;
      DELETE FROM menu_items;
      DELETE FROM settings;
    `);
    await seedData(db);
    await db.runAsync(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('version', ?)`, [String(DB_VERSION)]);
  }
}

const CATEGORIES = [
  { id: 1,  name: 'Street Food Platter', emoji: '🍗',  sort_order: 1 },
  { id: 2,  name: 'Pnoysilogan',         emoji: '🍳',  sort_order: 2 },
  { id: 3,  name: 'Mojos',               emoji: '🥔',  sort_order: 3 },
  { id: 4,  name: 'Fries',               emoji: '🍟',  sort_order: 4 },
  { id: 5,  name: 'Budget Meal',         emoji: '🍱',  sort_order: 5 },
  { id: 6,  name: 'Wings And Chips',     emoji: '🍗',  sort_order: 6 },
  { id: 7,  name: 'Inasal Express',      emoji: '🔥',  sort_order: 7 },
  { id: 8,  name: 'Golden Noodles',      emoji: '🍜',  sort_order: 8 },
  { id: 9,  name: 'Siomai',              emoji: '🥟',  sort_order: 9 },
  { id: 10, name: 'Additional',          emoji: '➕',  sort_order: 10 },
  { id: 11, name: 'Milk Shake',          emoji: '🥤',  sort_order: 11 },
  { id: 12, name: 'Ice Cream',           emoji: '🍦',  sort_order: 12 },
  { id: 13, name: 'Water',               emoji: '💧',  sort_order: 13 },
  { id: 14, name: 'Softdrinks',          emoji: '🥤',  sort_order: 14 },
  { id: 15, name: 'Milk Tea',            emoji: '🧋',  sort_order: 15 },
  { id: 16, name: 'Tsaí Refresher',      emoji: '🌿',  sort_order: 16 },
  { id: 17, name: 'Frappe',              emoji: '🧋',  sort_order: 17 },
  { id: 18, name: 'Iced Coffee',         emoji: '☕',  sort_order: 18 },
  { id: 19, name: 'Tsaí Fruity',         emoji: '🍵',  sort_order: 19 },
  { id: 20, name: 'All Matcha',          emoji: '🍵',  sort_order: 20 },
];

const MENU_ITEMS: { name: string; cat: number; price: number; emoji: string }[] = [
  // Street Food Platter
  { name: 'Chicken / Squid Balls 2 pcs', cat: 1, price: 30,  emoji: '🍢' },
  { name: 'Cheese Stick',                cat: 1, price: 30,  emoji: '🧀' },
  { name: 'Fish Ball 20 pcs',            cat: 1, price: 20,  emoji: '⚪' },
  { name: 'Kikiam 10 pcs',               cat: 1, price: 20,  emoji: '🍡' },
  // Pnoysilogan
  { name: 'Hamsilog',                    cat: 2, price: 50,  emoji: '🍳' },
  { name: 'Hotdog With Rice',            cat: 2, price: 50,  emoji: '🌭' },
  { name: 'Itlog',                       cat: 2, price: 15,  emoji: '🥚' },
  { name: 'Longganisa And Rice',         cat: 2, price: 70,  emoji: '🌭' },
  { name: 'Shanghai With Rice',          cat: 2, price: 60,  emoji: '🍱' },
  { name: 'Spam With Rice',              cat: 2, price: 50,  emoji: '🥫' },
  { name: 'Tapa At Rice',               cat: 2, price: 80,  emoji: '🥩' },
  { name: 'Tocino And Rice',             cat: 2, price: 65,  emoji: '🥩' },
  // Mojos
  { name: 'Chicken Wing With Mojos & Fries', cat: 3, price: 155, emoji: '🥔' },
  { name: 'Medium Mojos',               cat: 3, price: 75,  emoji: '🥔' },
  { name: 'Mojos Large',                cat: 3, price: 115, emoji: '🥔' },
  { name: 'Mojos/Fries Platter',        cat: 3, price: 145, emoji: '🥔' },
  { name: 'Platter Mojos',              cat: 3, price: 220, emoji: '🥔' },
  // Fries
  { name: 'Large Fries',                cat: 4, price: 70,  emoji: '🍟' },
  { name: 'Medium Fries',               cat: 4, price: 40,  emoji: '🍟' },
  { name: 'Platter Fries',              cat: 4, price: 99,  emoji: '🍟' },
  // Budget Meal
  { name: 'Boneless Chicken w/ Lemonade',              cat: 5, price: 70,  emoji: '🍱' },
  { name: 'Burger Steak w/ Lemonade',                  cat: 5, price: 70,  emoji: '🍱' },
  { name: 'Bicol Express W/ Softdrinks',               cat: 5, price: 115, emoji: '🍱' },
  { name: 'Chicken Fillet',                            cat: 5, price: 99,  emoji: '🍗' },
  { name: 'Chicken Fillet W/ Softdrinks',              cat: 5, price: 125, emoji: '🍗' },
  { name: 'Chicken Strips w/ Lemonade',                cat: 5, price: 80,  emoji: '🍗' },
  { name: 'Fried Pork With Softdrink',                 cat: 5, price: 115, emoji: '🍱' },
  { name: 'Hungarian w/ Lemonade',                     cat: 5, price: 70,  emoji: '🍱' },
  { name: 'Lumpia Shanghai',                           cat: 5, price: 60,  emoji: '🥟' },
  { name: 'Pork Chop Honey Glazed W/ Softdrinks',      cat: 5, price: 115, emoji: '🍱' },
  { name: 'Pork Giniling',                             cat: 5, price: 115, emoji: '🍱' },
  { name: 'SPAM w/ Lemonade',                         cat: 5, price: 70,  emoji: '🥫' },
  { name: 'Spicy Chicken Fillet w/ Lemonade',          cat: 5, price: 80,  emoji: '🍗' },
  { name: 'Siomai Rice With Drinks',                   cat: 5, price: 70,  emoji: '🥟' },
  // Wings And Chips
  { name: 'Boneless 8 Pcs & 2 Chicken Wings', cat: 6, price: 215, emoji: '🍗' },
  { name: 'Bucket Of Wings',                  cat: 6, price: 220, emoji: '🍗' },
  { name: 'Chicken Drums Stick With Glazed',  cat: 6, price: 85,  emoji: '🍗' },
  { name: 'Duo Wing With Drinks',             cat: 6, price: 99,  emoji: '🍗' },
  { name: 'Duo Wings',                        cat: 6, price: 75,  emoji: '🍗' },
  { name: 'Quadro Wing With Drinks',          cat: 6, price: 169, emoji: '🍗' },
  { name: 'Quadro Wings',                     cat: 6, price: 145, emoji: '🍗' },
  // Inasal Express
  { name: 'Bangus Sisig',               cat: 7, price: 139, emoji: '🐟' },
  { name: 'Barbecue Solo',              cat: 7, price: 99,  emoji: '🍢' },
  { name: 'Chicken Inasal PechoPak',    cat: 7, price: 189, emoji: '🍗' },
  { name: 'Chicken Inasal Paa',         cat: 7, price: 159, emoji: '🍗' },
  { name: 'Liempo Without Rice',        cat: 7, price: 145, emoji: '🥩' },
  { name: 'Liempo Inasal',              cat: 7, price: 165, emoji: '🥩' },
  { name: 'Paa Without Rice',           cat: 7, price: 145, emoji: '🍗' },
  { name: 'Para, Barbecue And Rice',    cat: 7, price: 195, emoji: '🍱' },
  { name: 'Pork Sisig Ala Cart',        cat: 7, price: 99,  emoji: '🍱' },
  { name: 'Pork BBQ',                   cat: 7, price: 109, emoji: '🍢' },
  { name: 'Pork Sisig',                 cat: 7, price: 119, emoji: '🍱' },
  // Golden Noodles
  { name: 'Fried Plain Noodles',        cat: 8, price: 35,  emoji: '🍜' },
  { name: 'Fried Noodle W/ Siomai',    cat: 8, price: 45,  emoji: '🍜' },
  { name: 'Fried Noodles W/ Dumplings',cat: 8, price: 55,  emoji: '🍜' },
  // Siomai
  { name: 'Big Siomai',                 cat: 9, price: 15,  emoji: '🥟' },
  { name: 'Beef Siomai',                cat: 9, price: 35,  emoji: '🥟' },
  { name: 'Chicken Siomai',             cat: 9, price: 35,  emoji: '🥟' },
  { name: 'Japanese Siomai',            cat: 9, price: 40,  emoji: '🥟' },
  { name: 'Pork Shrimp',               cat: 9, price: 35,  emoji: '🥟' },
  { name: 'Pork Siomai',               cat: 9, price: 35,  emoji: '🥟' },
  { name: 'Sharks Fin Dumplings',       cat: 9, price: 40,  emoji: '🥟' },
  { name: 'Siomai Rice',               cat: 9, price: 50,  emoji: '🥟' },
  { name: 'Wanton Dumplings',           cat: 9, price: 35,  emoji: '🥟' },
  // Additional
  { name: 'Coffee Jelly',              cat: 10, price: 10,  emoji: '🍮' },
  { name: 'Egg',                       cat: 10, price: 15,  emoji: '🥚' },
  { name: 'Extra Rice',                cat: 10, price: 20,  emoji: '🍚' },
  { name: 'Juice (small)',             cat: 10, price: 10,  emoji: '🥤' },
  { name: 'Juice (large)',             cat: 10, price: 25,  emoji: '🥤' },
  { name: 'Sauce',                     cat: 10, price: 5,   emoji: '🫙' },
  { name: 'Shanghai',                  cat: 10, price: 20,  emoji: '🥟' },
  // Milk Shake
  { name: 'Frappe',                    cat: 11, price: 88,  emoji: '🥤' },
  { name: 'Milkshake 16oz',            cat: 11, price: 55,  emoji: '🥤' },
  { name: 'Milkshake 22oz',            cat: 11, price: 65,  emoji: '🥤' },
  // Ice Cream
  { name: 'Hernz',                     cat: 12, price: 15,  emoji: '🍦' },
  { name: 'Butter Cup',                cat: 12, price: 30,  emoji: '🍦' },
  { name: 'Creamstick',                cat: 12, price: 23,  emoji: '🍦' },
  { name: 'Crunchy Bar',               cat: 12, price: 20,  emoji: '🍫' },
  { name: 'Dessert Bar',               cat: 12, price: 15,  emoji: '🍦' },
  { name: 'Fiesta ICS',                cat: 12, price: 15,  emoji: '🍦' },
  { name: 'Hernz 1.5L',               cat: 12, price: 200, emoji: '🍨' },
  { name: 'Hernz 3.0L',               cat: 12, price: 380, emoji: '🍨' },
  { name: 'Hernz Pint',               cat: 12, price: 75,  emoji: '🍨' },
  { name: 'Hernz 850ml',              cat: 12, price: 115, emoji: '🍨' },
  { name: 'Iced Lolly',               cat: 12, price: 10,  emoji: '🧊' },
  { name: 'Megastick',                 cat: 12, price: 33,  emoji: '🍦' },
  { name: 'Premium Buko Salad',        cat: 12, price: 20,  emoji: '🥥' },
  { name: 'Premium Crunchy Bar',       cat: 12, price: 30,  emoji: '🍫' },
  { name: 'Sundae Cup',                cat: 12, price: 15,  emoji: '🍨' },
  // Water
  { name: 'Bottled Water',             cat: 13, price: 15,  emoji: '💧' },
  { name: 'One Liter Water',           cat: 13, price: 25,  emoji: '💧' },
  { name: 'Water 500ml',               cat: 13, price: 10,  emoji: '💧' },
  // Softdrinks
  { name: '1.5L Coke',                cat: 14, price: 90,  emoji: '🥤' },
  { name: 'Coke Sakto',               cat: 14, price: 25,  emoji: '🥤' },
  { name: 'Fruit Soda',               cat: 14, price: 100, emoji: '🥤' },
  { name: 'Kasalo',                    cat: 14, price: 45,  emoji: '🥤' },
  { name: 'Mountaindew',              cat: 14, price: 25,  emoji: '🥤' },
  { name: 'Royal Sakto',              cat: 14, price: 25,  emoji: '🥤' },
  { name: 'Sprite Sakto',             cat: 14, price: 25,  emoji: '🥤' },
  // Milk Tea
  { name: 'Thai Milk Tea',            cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Cookies And Cream',        cat: 15, price: 38,  emoji: '🧋' },
  { name: 'Dark Chocolate',           cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Hokkaido',                 cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Matcha Milk Tea',          cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Okinawa',                  cat: 15, price: 38,  emoji: '🧋' },
  { name: 'Red Velvet Milk Tea',      cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Salted Caramel',           cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Strawberry Milk Tea',      cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Taro Milk Tea',            cat: 15, price: 48,  emoji: '🧋' },
  { name: 'Winter Melon',             cat: 15, price: 38,  emoji: '🧋' },
  // Frappe
  { name: 'Buco Pandan Frappe',       cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Cappuccino Frappe',        cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Cookies And Cream Frappe', cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Dark Choco Frappe',        cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Matcha Frappe',            cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Macchiato Frappe',         cat: 17, price: 78,  emoji: '🧋' },
  { name: 'Mocha Frappe',             cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Rocky Road Frappe',        cat: 17, price: 78,  emoji: '🧋' },
  { name: 'Red Velvet Frappe',        cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Sweet Avocado 16oz',       cat: 17, price: 78,  emoji: '🧋' },
  { name: 'Salted Caramel Frappe',    cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Strawberry Frappe',        cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Taro Frappe',              cat: 17, price: 88,  emoji: '🧋' },
  { name: 'Ube Macapuno 22oz',        cat: 17, price: 88,  emoji: '🧋' },
  // Iced Coffee
  { name: 'Caramel Iced Coffee',      cat: 18, price: 58,  emoji: '☕' },
  { name: 'Chocolate Iced Coffee',    cat: 18, price: 58,  emoji: '☕' },
  { name: 'Coffee Jelly Add On',      cat: 18, price: 10,  emoji: '☕' },
  { name: 'Latte',                    cat: 18, price: 58,  emoji: '☕' },
  { name: 'White Choco Iced Coffee',  cat: 18, price: 58,  emoji: '☕' },
  // Tsaí Fruity
  { name: '3 For 100 Fruit Soda',     cat: 19, price: 100, emoji: '🍵' },
  { name: 'Fruitsoda',                cat: 19, price: 49,  emoji: '🍵' },
  { name: 'Fruitsoda 12oz',           cat: 19, price: 29,  emoji: '🍵' },
  { name: 'Fruitsoda 16oz',           cat: 19, price: 39,  emoji: '🍵' },
  { name: 'Lemon Fruity',             cat: 19, price: 48,  emoji: '🍋' },
  { name: 'Lycee Small',              cat: 19, price: 38,  emoji: '🍵' },
  { name: 'Lycee Large',              cat: 19, price: 48,  emoji: '🍵' },
  { name: 'Mango Fruity',             cat: 19, price: 48,  emoji: '🥭' },
  { name: 'Mulberry',                 cat: 19, price: 48,  emoji: '🍵' },
  { name: 'Orange Fruity',            cat: 19, price: 48,  emoji: '🍊' },
  { name: 'Peach Fruity',             cat: 19, price: 48,  emoji: '🍑' },
  { name: 'Passion Fruit',            cat: 19, price: 48,  emoji: '🍵' },
  { name: 'Strawberry Fruity',        cat: 19, price: 48,  emoji: '🍓' },
  // All Matcha
  { name: 'Caramel Matcha',           cat: 20, price: 58,  emoji: '🍵' },
  { name: 'Chocolate Matcha',         cat: 20, price: 58,  emoji: '🍵' },
  { name: 'Matcha Original',          cat: 20, price: 58,  emoji: '🍵' },
  { name: 'White Choco Matcha',       cat: 20, price: 58,  emoji: '🍵' },
];

async function seedData(db: SQLite.SQLiteDatabase) {
  await db.runAsync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name', 'Little Giant Food Stall')`);
  await db.runAsync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'PHP')`);

  for (const c of CATEGORIES) {
    await db.runAsync(
      'INSERT OR REPLACE INTO categories (id, name, emoji, sort_order) VALUES (?, ?, ?, ?)',
      [c.id, c.name, c.emoji, c.sort_order]
    );
  }

  for (const item of MENU_ITEMS) {
    await db.runAsync(
      'INSERT INTO menu_items (name, category_id, price, emoji, is_available, is_archived, stock) VALUES (?, ?, ?, ?, 1, 0, 1)',
      [item.name, item.cat, item.price, item.emoji]
    );
  }
}
