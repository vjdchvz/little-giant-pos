// src/hooks/useFirebaseSync.ts — full two-way real-time sync
import { useEffect } from 'react';
import { listenOrders, listenStock, listenMenu } from '../services/firebaseSync';
import { useDashboardStore, useStockStore, useMenuStore } from '../store';
import { Order } from '../types';
import { StockItem } from '../services/localApi';
import { getDB } from '../db';

async function applyStockToSQLite(items: StockItem[]) {
  try {
    const db = await getDB();
    for (const item of items) {
      // Derive availability from stock count — never trust stale Firebase is_available
      const isAvail = item.stock > 0 ? 1 : 0;
      await db.runAsync(
        'UPDATE menu_items SET stock = ?, is_available = ? WHERE id = ?',
        [item.stock, isAvail, item.id]
      );
    }
  } catch (e) { console.warn('[Sync] applyStock failed:', e); }
}

async function applyMenuToSQLite(items: { id: number; is_available?: boolean; price?: number }[]) {
  try {
    const db = await getDB();
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
  } catch (e) { console.warn('[Sync] applyMenu failed:', e); }
}

async function applyOrdersToSQLite(orders: Order[]) {
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

export function useFirebaseSync() {
  const { setRecentOrders, triggerRefresh: triggerDashRefresh } = useDashboardStore();
  const { setIngredients } = useStockStore();
  const { setItems, triggerRefresh } = useMenuStore();

  useEffect(() => {
    // Live orders → SQLite + dashboard refresh
    const unsubOrders = listenOrders((orders: Order[]) => {
      const completed = orders.filter(o => o.status !== 'voided');
      setRecentOrders(completed.slice(0, 20));
      applyOrdersToSQLite(orders);
      triggerDashRefresh(); // tell DashboardScreen to reload from SQLite
    });

    // Live stock → SQLite + nav badge
    const unsubStock = listenStock((items: StockItem[]) => {
      applyStockToSQLite(items);
      triggerRefresh(); // tell MenuScreen to reload
      const mapped = items.map(i => ({
        id: i.id, name: i.name, emoji: i.emoji ?? '📦', unit: 'pcs',
        current_stock: i.stock, min_stock: 5, is_low: i.stock <= 5,
      }));
      setIngredients(mapped as any);
    });

    // Live menu (availability + price) → SQLite + MenuScreen reload
    const unsubMenu = listenMenu((items) => {
      applyMenuToSQLite(items);
      triggerRefresh(); // MenuScreen reloads
    });

    return () => { unsubOrders(); unsubStock(); unsubMenu(); };
  }, []);
}
