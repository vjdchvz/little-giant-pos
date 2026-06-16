// src/services/firebaseSync.ts — Realtime Database two-way sync
import { ref, set, update, onValue, off } from 'firebase/database';
import { db } from './firebase';
import { Order } from '../types';
import { StockItem } from './localApi';

// ─── Push order ───────────────────────────────────────────────────────────────
export async function pushOrder(order: Order, cashierName?: string): Promise<void> {
  try {
    await set(ref(db, `pos_orders/${order.order_number}`), {
      id:             order.id,
      order_number:   order.order_number,
      status:         order.status,
      payment_method: order.payment_method,
      subtotal:       order.subtotal ?? 0,
      discount:       order.discount ?? 0,
      total:          order.total,
      notes:          order.notes ?? null,
      cashier_name:   cashierName ?? 'Cashier',
      created_at:     order.created_at,
      items:          order.items.map(i => ({
        menu_item_id: i.menu_item_id,
        name:         i.name,
        price:        i.price,
        qty:          i.qty,
        subtotal:     i.subtotal,
        notes:        i.notes ?? null,
        emoji:        i.emoji ?? '🍽️',
      })),
    });
  } catch (e) { console.warn('[Sync] pushOrder failed:', e); }
}

// ─── Push void ────────────────────────────────────────────────────────────────
export async function pushVoid(orderNumber: string, reason: string): Promise<void> {
  try {
    await update(ref(db, `pos_orders/${orderNumber}`), {
      status: 'voided', notes: `VOID: ${reason}`,
    });
  } catch (e) { console.warn('[Sync] pushVoid failed:', e); }
}

// ─── Push stock ───────────────────────────────────────────────────────────────
export async function pushStock(item: StockItem): Promise<void> {
  try {
    await set(ref(db, `pos_stock/${item.id}`), {
      id: item.id, name: item.name, emoji: item.emoji,
      category_id: item.category_id, category_name: item.category_name,
      stock: item.stock, is_available: item.is_available,
    });
  } catch (e) { console.warn('[Sync] pushStock failed:', e); }
}

export async function pushStockBulk(items: StockItem[]): Promise<void> {
  await Promise.allSettled(items.map(pushStock));
}

// ─── Push menu item (availability + price) ───────────────────────────────────
export async function pushMenuItem(id: number, data: { is_available?: boolean; price?: number; name?: string; emoji?: string }): Promise<void> {
  try {
    await update(ref(db, `pos_menu/${id}`), { id, ...data });
  } catch (e) { console.warn('[Sync] pushMenuItem failed:', e); }
}

// ─── Clear all orders (owner reset) ──────────────────────────────────────────
export async function clearFirebaseOrders(): Promise<void> {
  await set(ref(db, 'pos_orders'), null);
}

// ─── Listeners ───────────────────────────────────────────────────────────────
export function listenOrders(onData: (orders: Order[]) => void): () => void {
  const r = ref(db, 'pos_orders');
  onValue(r, snap => {
    const val = snap.val();
    if (!val) return;
    const orders: Order[] = Object.values(val) as Order[];
    orders.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    onData(orders.slice(0, 100));
  }, err => console.warn('[Sync] listenOrders error:', err));
  return () => off(r);
}

export function listenStock(onData: (items: StockItem[]) => void): () => void {
  const r = ref(db, 'pos_stock');
  onValue(r, snap => {
    const val = snap.val();
    if (!val) return;
    onData(Object.values(val) as StockItem[]);
  }, err => console.warn('[Sync] listenStock error:', err));
  return () => off(r);
}

export function listenMenu(onData: (items: { id: number; is_available?: boolean; price?: number }[]) => void): () => void {
  const r = ref(db, 'pos_menu');
  onValue(r, snap => {
    const val = snap.val();
    if (!val) return;
    onData(Object.values(val) as any[]);
  }, err => console.warn('[Sync] listenMenu error:', err));
  return () => off(r);
}
