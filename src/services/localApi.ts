// src/services/localApi.ts — v5: Firebase sync layer
import { getDB } from '../db';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MenuItem, Order, CartItem, PaymentMethod, DailySummary } from '../types';
import { pushOrder, pushVoid, pushStock, pushStockBulk, clearFirebaseOrders, pushMenuItem, removeMenuItem } from './firebaseSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-device code so order numbers are globally unique across devices, even
// when two devices are offline at the same time (prevents Firebase key
// collisions / lost orders on reconnect). Cached after first read.
let cachedDeviceCode: string | null = null;
async function getDeviceCode(): Promise<string> {
  if (cachedDeviceCode) return cachedDeviceCode;
  let code = await AsyncStorage.getItem('device_code');
  if (!code) {
    // 2-char base36 code, e.g. "A7" — 1296 combos, ample for a food stall
    code = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');
    await AsyncStorage.setItem('device_code', code);
  }
  cachedDeviceCode = code;
  return code;
}

function rowToStockItem(row: any): StockItem {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? '🍽️',
    price: row.price ?? 0,
    category_id: row.category_id,
    category_name: row.category_name ?? 'Uncategorized',
    stock: row.stock ?? 0,
    is_available: row.is_available === 1,
  };
}

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

// Thrown when an order's requested qty exceeds live DB stock (DB = source of truth)
export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

// ─── Menu ────────────────────────────────────────────────────────────────────
export const menuAPI = {
  getAll: async (): Promise<MenuItem[]> => {
    const db = await getDB();
    const rows = await db.getAllAsync<any>(`
      SELECT m.*, c.name as category_name
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.is_archived = 0
      ORDER BY c.sort_order, m.id
    `);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      category_id: row.category_id,
      category_name: row.category_name ?? 'Uncategorized',
      price: row.price,
      emoji: row.emoji ?? '🍽️',
      description: row.description ?? '',
      is_available: row.is_available === 1,
      servings_left: row.stock ?? 0,
    }));
  },

  getCategories: async () => {
    const db = await getDB();
    return db.getAllAsync<any>('SELECT * FROM categories ORDER BY sort_order');
  },

  addItem: async (data: { name: string; price: number; emoji: string; category_id: number | null; stock?: number }): Promise<number> => {
    const db = await getDB();
    const stock = data.stock ?? 0;
    const res = await db.runAsync(
      'INSERT INTO menu_items (name, price, emoji, category_id, is_available, is_archived, stock) VALUES (?, ?, ?, ?, ?, 0, ?)',
      [data.name, data.price, data.emoji, data.category_id, stock > 0 ? 1 : 0, stock]
    );
    const id = res.lastInsertRowId;
    // Push new item to Firebase menu control + stock levels
    pushMenuItem(id, { name: data.name, price: data.price, emoji: data.emoji, is_available: stock > 0 });
    const r = await db.getFirstAsync<any>(
      `SELECT m.id, m.name, m.emoji, m.price, m.category_id, m.stock, m.is_available, c.name as category_name
       FROM menu_items m LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [id]
    );
    if (r) {
      pushStock(rowToStockItem(r));
    }
    return id;
  },

  deleteItem: async (id: number): Promise<void> => {
    const db = await getDB();
    await db.runAsync('UPDATE menu_items SET is_archived = 1 WHERE id = ?', [id]);
    removeMenuItem(id); // remove from Firebase menu control + stock levels
  },

  updateItem: async (id: number, data: Partial<MenuItem>): Promise<void> => {
    const db = await getDB();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.emoji !== undefined) { fields.push('emoji = ?'); values.push(data.emoji); }
    if (data.category_id !== undefined) { fields.push('category_id = ?'); values.push(data.category_id); }
    if (fields.length === 0) return;
    values.push(id);
    await db.runAsync(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  updateAvailability: async (id: number, is_available: boolean): Promise<MenuItem> => {
    const db = await getDB();
    await db.runAsync('UPDATE menu_items SET is_available = ? WHERE id = ?', [is_available ? 1 : 0, id]);
    const row = await db.getFirstAsync<any>(`
      SELECT m.*, c.name as category_name FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [id]);
    // Sync to Firebase pos_menu only (matches the web dashboard's own toggle) —
    // pushing to pos_stock too would let the next stock sync re-derive
    // is_available from stock count and silently undo this manual override.
    pushMenuItem(id, { name: row.name, price: row.price, emoji: row.emoji, is_available });
    return { ...row, is_available: row.is_available === 1 };
  },
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersAPI = {
  // Wipe all sales/orders locally AND in Firebase (owner reset)
  clearSalesData: async (): Promise<void> => {
    const db = await getDB();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM order_items');
      await db.runAsync('DELETE FROM orders');
    });
    try {
      await clearFirebaseOrders();
    } catch (e) { console.warn('[Reset] clearFirebaseOrders failed:', e); }
  },

  create: async (payload: {
    items: CartItem[];
    payment_method: PaymentMethod;
    discount?: number;
    cashier_name?: string;
    notes?: string;
  }): Promise<Order> => {
    const db = await getDB();
    const discount = payload.discount ?? 0;
    const subtotal = payload.items.reduce((s, i) => s + i.subtotal, 0);
    const total = subtotal - discount;

    // DB is the source of truth — validate live stock before committing
    for (const item of payload.items) {
      const row = await db.getFirstAsync<{ stock: number; name: string }>(
        'SELECT stock, name FROM menu_items WHERE id = ?', [item.menu_item_id]
      );
      const available = row?.stock ?? 0;
      if (available < item.qty) {
        throw new InsufficientStockError(
          `Not enough stock for ${row?.name ?? item.name}. Only ${available} left.`
        );
      }
    }

    const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM orders');
    const deviceCode = await getDeviceCode();
    const orderNumber = `LG-${deviceCode}${((count?.c ?? 0) + 1).toString().padStart(4, '0')}`;

    await db.withTransactionAsync(async () => {
      const result = await db.runAsync(
        `INSERT INTO orders (order_number, status, payment_method, subtotal, discount, total, cashier_name, notes)
         VALUES (?, 'completed', ?, ?, ?, ?, ?, ?)`,
        [orderNumber, payload.payment_method, subtotal, discount, total, payload.cashier_name ?? null, payload.notes ?? null]
      );
      const orderId = result.lastInsertRowId;

      for (const item of payload.items) {
        await db.runAsync(
          `INSERT INTO order_items (order_id, menu_item_id, name, price, qty, subtotal, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.menu_item_id, item.name, item.price, item.qty, item.subtotal, item.notes ?? null]
        );
        // Deduct stock guarded so it never goes below 0, then auto-mark unavailable at 0
        await db.runAsync(
          'UPDATE menu_items SET stock = MAX(stock - ?, 0) WHERE id = ?',
          [item.qty, item.menu_item_id]
        );
        await db.runAsync(
          'UPDATE menu_items SET is_available = 0 WHERE id = ? AND stock = 0',
          [item.menu_item_id]
        );
      }
    });

    const order = await db.getFirstAsync<any>('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
    const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const fullOrder: Order = { ...order, items };
    pushOrder(fullOrder); // sync order to Firebase (best-effort)

    // Push updated stock for each sold item so Firebase/web/other devices stay in sync
    const soldIds = [...new Set(payload.items.map(i => i.menu_item_id))];
    for (const id of soldIds) {
      const r = await db.getFirstAsync<any>(
        `SELECT m.id, m.name, m.emoji, m.price, m.category_id, m.stock, m.is_available, c.name as category_name
         FROM menu_items m LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [id]
      );
      if (r) {
        pushStock(rowToStockItem(r));
      }
    }
    return fullOrder;
  },

  getRecent: async (limit = 20): Promise<Order[]> => {
    const db = await getDB();
    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status != 'voided' ORDER BY created_at DESC LIMIT ?`, [limit]
    );
    const result: Order[] = [];
    for (const o of orders) {
      const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      result.push({ ...o, items });
    }
    return result;
  },

  // For history screen — includes voided
  getHistory: async (limit = 100): Promise<Order[]> => {
    const db = await getDB();
    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`, [limit]
    );
    const result: Order[] = [];
    for (const o of orders) {
      const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      result.push({ ...o, items });
    }
    return result;
  },

  getById: async (id: number): Promise<Order> => {
    const db = await getDB();
    const order = await db.getFirstAsync<any>('SELECT * FROM orders WHERE id = ?', [id]);
    const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [id]);
    return { ...order, items };
  },

  void: async (id: number, reason: string): Promise<Order> => {
    const db = await getDB();
    // Guard against double-void (would restore stock twice)
    const current = await db.getFirstAsync<{ status: string }>('SELECT status FROM orders WHERE id = ?', [id]);
    if (!current) throw new Error('Order not found.');
    if (current.status === 'voided') return ordersAPI.getById(id);

    let restoredIds: number[] = [];
    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE orders SET status = 'voided', notes = ? WHERE id = ? AND status != 'voided'`, [`VOID: ${reason}`, id]);
      const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const oi of items) {
        await db.runAsync(
          'UPDATE menu_items SET stock = stock + ?, is_available = 1 WHERE id = ?',
          [oi.qty, oi.menu_item_id]
        );
      }
      restoredIds = [...new Set(items.map((oi: any) => oi.menu_item_id))];
    });
    const voided = await ordersAPI.getById(id);
    pushVoid(voided.order_number, reason); // sync order status to Firebase

    // Push restored stock so web + other devices reflect the returned stock
    for (const mid of restoredIds) {
      const r = await db.getFirstAsync<any>(
        `SELECT m.id, m.name, m.emoji, m.price, m.category_id, m.stock, m.is_available, c.name as category_name
         FROM menu_items m LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [mid]
      );
      if (r) {
        pushStock(rowToStockItem(r));
      }
    }
    return voided;
  },
};

// ─── Stock ───────────────────────────────────────────────────────────────────
export interface StockItem {
  id: number;
  name: string;
  emoji: string;
  price: number;
  category_id: number;
  category_name: string;
  stock: number;
  is_available: boolean;
}

export const stockAPI = {
  getAll: async (): Promise<StockItem[]> => {
    const db = await getDB();
    const rows = await db.getAllAsync<any>(`
      SELECT m.id, m.name, m.emoji, m.price, m.category_id, m.stock, m.is_available,
             c.name as category_name
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.is_archived = 0
      ORDER BY c.sort_order, m.name
    `);
    return rows.map(rowToStockItem);
  },

  // Always derive is_available from the resulting stock — restocking an item
  // that was sold out must bring it back available automatically.
  restock: async (id: number, qty: number): Promise<StockItem> => {
    const db = await getDB();
    await db.runAsync(
      'UPDATE menu_items SET stock = stock + ?, is_available = CASE WHEN stock + ? > 0 THEN 1 ELSE 0 END WHERE id = ?',
      [qty, qty, id]
    );
    const row = await db.getFirstAsync<any>(`
      SELECT m.*, c.name as category_name FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [id]);
    const item = rowToStockItem(row);
    pushStock(item);
    return item;
  },

  setStock: async (id: number, qty: number): Promise<StockItem> => {
    const db = await getDB();
    const clamped = Math.max(0, qty);
    await db.runAsync(
      'UPDATE menu_items SET stock = ?, is_available = ? WHERE id = ?',
      [clamped, clamped > 0 ? 1 : 0, id]
    );
    const row = await db.getFirstAsync<any>(`
      SELECT m.*, c.name as category_name FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [id]);
    const item = rowToStockItem(row);
    pushStock(item);
    return item;
  },

  logWaste: async (id: number, qty: number): Promise<StockItem> => {
    const db = await getDB();
    await db.runAsync(
      'UPDATE menu_items SET stock = MAX(stock - ?, 0), is_available = CASE WHEN MAX(stock - ?, 0) > 0 THEN 1 ELSE 0 END WHERE id = ?',
      [qty, qty, id]
    );
    const row = await db.getFirstAsync<any>(`
      SELECT m.*, c.name as category_name FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?`, [id]);
    const item = rowToStockItem(row);
    pushStock(item);
    return item;
  },

  // Fast bulk restock: one SQL statement for all items (was N sequential
  // round-trips, slow and prone to stalling on 100+ items), then push all
  // updated stock to Firebase concurrently. Reports progress via onProgress.
  bulkRestock: async (qty: number, onProgress?: (done: number, total: number) => void): Promise<StockItem[]> => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE menu_items SET stock = stock + ?, is_available = CASE WHEN stock + ? > 0 THEN 1 ELSE 0 END
       WHERE is_archived = 0`,
      [qty, qty]
    );
    const rows = await db.getAllAsync<any>(`
      SELECT m.*, c.name as category_name FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id WHERE m.is_archived = 0`);
    const items = rows.map(rowToStockItem);

    let done = 0;
    await Promise.all(items.map(async item => {
      await pushStock(item);
      done++;
      onProgress?.(done, items.length);
    }));
    return items;
  },
};

// ─── Reports ─────────────────────────────────────────────────────────────────
function periodWhere(period: ReportPeriod): string {
  switch (period) {
    case 'day':   return `date(created_at) = date('now','localtime')`;
    case 'week':  return `date(created_at) >= date('now','localtime','-6 days')`;
    case 'month': return `strftime('%Y-%m', created_at) = strftime('%Y-%m', datetime('now','localtime'))`;
    case 'year':  return `strftime('%Y', created_at) = strftime('%Y', datetime('now','localtime'))`;
  }
}

export const reportsAPI = {
  getSummary: async (period: ReportPeriod = 'day'): Promise<DailySummary> => {
    const db = await getDB();
    const where = periodWhere(period);

    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status = 'completed' AND ${where}`
    );

    const grossSales = orders.reduce((s: number, o: any) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? grossSales / totalOrders : 0;

    const breakdown = { cash: 0, gcash: 0, maya: 0 } as any;
    for (const o of orders) {
      const m = o.payment_method?.toLowerCase();
      if (m in breakdown) breakdown[m] += o.total;
    }

    const itemStats: Record<number, any> = {};
    for (const o of orders) {
      const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      for (const oi of items) {
        if (!itemStats[oi.menu_item_id]) {
          const mi = await db.getFirstAsync<any>('SELECT emoji FROM menu_items WHERE id = ?', [oi.menu_item_id]);
          itemStats[oi.menu_item_id] = { menu_item_id: oi.menu_item_id, name: oi.name, emoji: mi?.emoji ?? '🍽️', qty_sold: 0, revenue: 0 };
        }
        itemStats[oi.menu_item_id].qty_sold += oi.qty;
        itemStats[oi.menu_item_id].revenue += oi.subtotal;
      }
    }
    const topItems = Object.values(itemStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      date: period,
      gross_sales: grossSales,
      total_orders: totalOrders,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      top_items: topItems,
      payment_breakdown: breakdown,
      low_stock_count: 0,
    };
  },

  // Keep for backward compat
  getDaily: async (date?: string): Promise<DailySummary> => reportsAPI.getSummary('day'),

  getHourly: async (date?: string) => {
    const db = await getDB();
    const target = date ?? new Date().toISOString().split('T')[0];
    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status = 'completed' AND date(created_at) = ?`, [target]
    );
    const hourly: Record<number, { hour: number; total: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) hourly[h] = { hour: h, total: 0, orders: 0 };
    for (const o of orders) {
      const h = new Date(o.created_at).getHours();
      hourly[h].total += o.total;
      hourly[h].orders += 1;
    }
    return Object.values(hourly);
  },
};

export const csvAPI = {
  exportSales: async (period: ReportPeriod = 'day'): Promise<void> => {
    const db = await getDB();
    const where = periodWhere(period);
    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status = 'completed' AND ${where} ORDER BY created_at DESC`
    );

    const rows: string[] = ['Order #,Date,Payment,Total'];
    for (const o of orders) {
      const d = new Date(o.created_at).toLocaleString('en-PH');
      rows.push(`"${o.order_number}","${d}","${o.payment_method}",${o.total}`);
    }
    const csv = rows.join('\n');
    const fileName = `LittleGiant_Sales_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    const uri = (FileSystem.cacheDirectory ?? FileSystem.documentDirectory) + fileName;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Export Sales CSV' });
    }
  },
};

export const aiAPI = {
  chat: async () => ({ response: '' }),
  generateEOD: async () => ({ report: '' }),
  getForecast: async () => ({}),
};
