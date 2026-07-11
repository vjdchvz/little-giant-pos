// src/services/cloudSync.ts — apply Firebase data into local SQLite.
// Shared by the live listeners (useFirebaseSync) and the manual "Sync Now".
import { ref, get } from 'firebase/database';
import { db as fdb } from './firebase';
import { getDB, withWriteLock } from '../db';
import { Order } from '../types';
import { StockItem } from './localApi';

// pos_stock always carries the FULL current set of items — any menu_item id
// missing from it (e.g. deleted from the web admin or another device) is
// archived locally so it stops being sellable everywhere, not just remotely.
export async function archiveMissingLocally(presentIds: number[]) {
  if (presentIds.length === 0) return; // never archive everything on an empty/partial payload
  try {
    const db = await getDB();
    const placeholders = presentIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE menu_items SET is_archived = 1 WHERE is_archived = 0 AND id NOT IN (${placeholders})`,
      presentIds
    );
  } catch (e) { console.warn('[Sync] archiveMissingLocally failed:', e); }
}

export async function applyStockToSQLite(items: StockItem[]) {
  try {
    const db = await getDB();
    // One transaction instead of N autocommits — avoids blocking the JS thread
    await withWriteLock(() => db.withTransactionAsync(async () => {
      for (const item of items) {
        // Derive availability from stock count — never trust stale Firebase is_available
        const isAvail = item.stock > 0 ? 1 : 0;
        // Upsert: items created remotely (e.g. from the web admin) don't exist
        // locally yet — INSERT them; existing rows only get stock/availability
        // touched here so name/price edits made elsewhere aren't clobbered.
        await db.runAsync(
          `INSERT INTO menu_items (id, name, price, emoji, category_id, is_available, is_archived, stock)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)
           ON CONFLICT(id) DO UPDATE SET stock = excluded.stock, is_available = excluded.is_available`,
          [item.id, item.name, item.price ?? 0, item.emoji, item.category_id, isAvail, item.stock]
        );
      }
    }));
  } catch (e) { console.warn('[Sync] applyStock failed:', e); }
}

export async function applyMenuToSQLite(items: { id: number; is_available?: boolean; price?: number }[]) {
  try {
    const db = await getDB();
    await withWriteLock(() => db.withTransactionAsync(async () => {
      for (const item of items) {
        if (item.is_available !== undefined && item.price !== undefined) {
          await db.runAsync('UPDATE menu_items SET is_available = ?, price = ? WHERE id = ?',
            [item.is_available ? 1 : 0, item.price, item.id]);
        } else if (item.is_available !== undefined) {
          await db.runAsync('UPDATE menu_items SET is_available = ? WHERE id = ?',
            [item.is_available ? 1 : 0, item.id]);
        } else if (item.price !== undefined) {
          await db.runAsync('UPDATE menu_items SET price = ? WHERE id = ?',
            [item.price, item.id]);
        }
      }
    }));
  } catch (e) { console.warn('[Sync] applyMenu failed:', e); }
}

export async function applyOrdersToSQLite(orders: Order[]) {
  try {
    const db = await getDB();
    for (const order of orders) {
      const exists = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM orders WHERE order_number = ?', [order.order_number]
      );
      if (!exists) {
        await db.runAsync(
          `INSERT OR IGNORE INTO orders (order_number, status, payment_method, subtotal, discount, total, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [order.order_number, order.status, order.payment_method,
           order.subtotal ?? 0, order.discount ?? 0, order.total,
           order.notes ?? null, order.created_at]
        );
        const row = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM orders WHERE order_number = ?', [order.order_number]
        );
        if (row && order.items?.length) {
          for (const item of order.items) {
            await db.runAsync(
              `INSERT OR IGNORE INTO order_items (order_id, menu_item_id, name, price, qty, subtotal, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [row.id, item.menu_item_id, item.name, item.price,
               item.qty, item.subtotal, item.notes ?? null]
            );
          }
        }
      } else if (order.status === 'voided') {
        await db.runAsync(
          `UPDATE orders SET status = 'voided', notes = ? WHERE order_number = ?`,
          [order.notes ?? null, order.order_number]
        );
      }
    }
  } catch (e) { console.warn('[Sync] applyOrders failed:', e); }
}

// One-shot pull: read the whole cloud DB and write it into local SQLite.
export async function pullFromCloud(): Promise<{ stock: number; menu: number; orders: number }> {
  const [stockSnap, menuSnap, ordersSnap] = await Promise.all([
    get(ref(fdb, 'pos_stock')),
    get(ref(fdb, 'pos_menu')),
    get(ref(fdb, 'pos_orders')),
  ]);

  const stock = stockSnap.val() ? Object.values(stockSnap.val()) as StockItem[] : [];
  const menu = menuSnap.val() ? Object.values(menuSnap.val()) as any[] : [];
  const orders = ordersSnap.val() ? Object.values(ordersSnap.val()) as Order[] : [];

  if (stock.length) await applyStockToSQLite(stock);
  if (menu.length) await applyMenuToSQLite(menu);
  if (orders.length) await applyOrdersToSQLite(orders);

  return { stock: stock.length, menu: menu.length, orders: orders.length };
}
