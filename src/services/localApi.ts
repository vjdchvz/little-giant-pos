// src/services/localApi.ts
// SQLite-backed API — same interface as api.ts so screens need no changes

import { getDB } from '../db';
import { MenuItem, Ingredient, Order, CartItem, PaymentMethod, DailySummary } from '../types';

// ─── Menu ────────────────────────────────────────────────────────────────────
export const menuAPI = {
  getAll: async (): Promise<MenuItem[]> => {
    const db = await getDB();
    const rows = await db.getAllAsync<any>(`
      SELECT m.*, c.name as category_name
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.is_archived = 0
      ORDER BY m.category_id, m.id
    `);

    const items: MenuItem[] = [];
    for (const row of rows) {
      const servings = await computeServings(db, row.id);
      items.push({
        id: row.id,
        name: row.name,
        category_id: row.category_id,
        category_name: row.category_name,
        price: row.price,
        emoji: row.emoji,
        description: row.description,
        is_available: row.is_available === 1,
        servings_left: servings,
      });
    }
    return items;
  },

  getCategories: async () => {
    const db = await getDB();
    return db.getAllAsync('SELECT * FROM categories ORDER BY sort_order');
  },

  updateItem: async (id: number, data: Partial<MenuItem>): Promise<void> => {
    const db = await getDB();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.price !== undefined) { fields.push('price = ?'); values.push(data.price); }
    if (data.emoji !== undefined) { fields.push('emoji = ?'); values.push(data.emoji); }
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
    return { ...row, is_available: row.is_available === 1 };
  },
};

async function computeServings(db: any, menuItemId: number): Promise<number> {
  const recipes = await db.getAllAsync<any>(
    'SELECT r.qty_per_order, i.qty FROM recipes r JOIN ingredients i ON r.ingredient_id = i.id WHERE r.menu_item_id = ?',
    [menuItemId]
  );
  if (recipes.length === 0) return 999;
  let min = Infinity;
  for (const r of recipes) {
    if (r.qty_per_order > 0) {
      min = Math.min(min, Math.floor(r.qty / r.qty_per_order));
    }
  }
  return min === Infinity ? 0 : min;
}

// ─── Orders ──────────────────────────────────────────────────────────────────
export const ordersAPI = {
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

    // Generate order number
    const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM orders');
    const orderNumber = `LG-${((count?.c ?? 0) + 1).toString().padStart(3, '0')}`;

    await db.withTransactionAsync(async () => {
      // Insert order
      const result = await db.runAsync(
        `INSERT INTO orders (order_number, status, payment_method, subtotal, discount, total, cashier_name, notes)
         VALUES (?, 'completed', ?, ?, ?, ?, ?, ?)`,
        [orderNumber, payload.payment_method, subtotal, discount, total, payload.cashier_name ?? null, payload.notes ?? null]
      );
      const orderId = result.lastInsertRowId;

      for (const item of payload.items) {
        // Insert order item
        await db.runAsync(
          `INSERT INTO order_items (order_id, menu_item_id, name, price, qty, subtotal, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.menu_item_id, item.name, item.price, item.qty, item.subtotal, item.notes ?? null]
        );

        // Deduct ingredients
        const recipes = await db.getAllAsync<any>(
          'SELECT * FROM recipes WHERE menu_item_id = ?', [item.menu_item_id]
        );
        for (const recipe of recipes) {
          const ing = await db.getFirstAsync<any>(
            'SELECT * FROM ingredients WHERE id = ?', [recipe.ingredient_id]
          );
          if (!ing) continue;
          const deduct = recipe.qty_per_order * item.qty;
          const qtyBefore = ing.qty;
          const qtyAfter = Math.max(qtyBefore - deduct, 0);
          await db.runAsync(
            'UPDATE ingredients SET qty = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
            [qtyAfter, ing.id]
          );
          await db.runAsync(
            `INSERT INTO stock_movements (ingredient_id, type, qty_change, qty_before, qty_after, reference_id, note)
             VALUES (?, 'sale_deduction', ?, ?, ?, ?, ?)`,
            [ing.id, -deduct, qtyBefore, qtyAfter, orderId, `Order ${orderNumber}`]
          );
        }
      }
    });

    // Return full order
    const order = await db.getFirstAsync<any>('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
    const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    return { ...order, items, created_at: order.created_at };
  },

  getRecent: async (limit = 20): Promise<Order[]> => {
    const db = await getDB();
    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status != 'voided' ORDER BY created_at DESC LIMIT ?`, [limit]
    );
    const result: Order[] = [];
    for (const o of orders) {
      const items = await db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      result.push({ ...o, items, is_available: undefined });
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
    await db.runAsync(`UPDATE orders SET status = 'voided', notes = ? WHERE id = ?`, [`VOID: ${reason}`, id]);
    return ordersAPI.getById(id);
  },
};

// ─── Stock ───────────────────────────────────────────────────────────────────
export const stockAPI = {
  getAll: async (): Promise<Ingredient[]> => {
    const db = await getDB();
    const rows = await db.getAllAsync<any>('SELECT * FROM ingredients ORDER BY name');
    return rows.map(toIngredient);
  },

  restock: async (id: number, qty: number, note?: string) => {
    const db = await getDB();
    const ing = await db.getFirstAsync<any>('SELECT * FROM ingredients WHERE id = ?', [id]);
    if (!ing) throw new Error('Not found');
    const qtyAfter = ing.qty + qty;
    await db.runAsync(
      'UPDATE ingredients SET qty = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
      [qtyAfter, id]
    );
    await db.runAsync(
      `INSERT INTO stock_movements (ingredient_id, type, qty_change, qty_before, qty_after, note)
       VALUES (?, 'restock', ?, ?, ?, ?)`,
      [id, qty, ing.qty, qtyAfter, note ?? null]
    );
    const updated = await db.getFirstAsync<any>('SELECT * FROM ingredients WHERE id = ?', [id]);
    return toIngredient(updated);
  },

  logWaste: async (id: number, qty: number, reason: string) => {
    const db = await getDB();
    const ing = await db.getFirstAsync<any>('SELECT * FROM ingredients WHERE id = ?', [id]);
    if (!ing) throw new Error('Not found');
    const qtyAfter = Math.max(ing.qty - qty, 0);
    await db.runAsync(
      'UPDATE ingredients SET qty = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
      [qtyAfter, id]
    );
    await db.runAsync(
      `INSERT INTO stock_movements (ingredient_id, type, qty_change, qty_before, qty_after, note)
       VALUES (?, 'waste', ?, ?, ?, ?)`,
      [id, -qty, ing.qty, qtyAfter, reason]
    );
    const updated = await db.getFirstAsync<any>('SELECT * FROM ingredients WHERE id = ?', [id]);
    return toIngredient(updated);
  },

  adjust: async (id: number, qty: number, note: string) => {
    const db = await getDB();
    const ing = await db.getFirstAsync<any>('SELECT * FROM ingredients WHERE id = ?', [id]);
    if (!ing) throw new Error('Not found');
    const change = qty - ing.qty;
    await db.runAsync(
      'UPDATE ingredients SET qty = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
      [qty, id]
    );
    await db.runAsync(
      `INSERT INTO stock_movements (ingredient_id, type, qty_change, qty_before, qty_after, note)
       VALUES (?, 'adjustment', ?, ?, ?, ?)`,
      [id, change, ing.qty, qty, note]
    );
    const updated = await db.getFirstAsync<any>('SELECT * FROM ingredients WHERE id = ?', [id]);
    return toIngredient(updated);
  },
};

function toIngredient(row: any): Ingredient {
  const qty = row.qty;
  const max = row.max_qty;
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    qty,
    max_qty: max,
    low_threshold: row.low_threshold,
    cost_per_unit: row.cost_per_unit,
    stock_pct: max > 0 ? Math.round((qty / max) * 1000) / 10 : 0,
    is_low: qty <= row.low_threshold,
  };
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsAPI = {
  getDaily: async (date?: string): Promise<DailySummary> => {
    const db = await getDB();
    const target = date ?? new Date().toISOString().split('T')[0];

    const orders = await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status = 'completed' AND date(created_at) = ?`, [target]
    );

    const grossSales = orders.reduce((s: number, o: any) => s + o.total, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? grossSales / totalOrders : 0;

    const breakdown = { cash: 0, gcash: 0, maya: 0 } as any;
    for (const o of orders) {
      if (o.payment_method in breakdown) breakdown[o.payment_method] += o.total;
    }

    // Top items
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

    const lowCount = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM ingredients WHERE qty <= low_threshold'
    );

    return {
      date: target,
      gross_sales: grossSales,
      total_orders: totalOrders,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      top_items: topItems,
      payment_breakdown: breakdown,
      low_stock_count: lowCount?.c ?? 0,
    };
  },

  getWeekly: async () => ({ weeks: [] }),

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

// ai not used — placeholder to avoid import errors
export const aiAPI = {
  chat: async () => ({ response: '' }),
  generateEOD: async () => ({ report: '' }),
  getForecast: async () => ({}),
};
