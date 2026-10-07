// src/services/firebaseSync.ts — Realtime Database two-way sync (offline-aware)
import { ref, set, update, get, onValue, off } from 'firebase/database';
import { db } from './firebase';
import { Order } from '../types';
import { StockItem } from './localApi';
import { enqueue, flushQueue } from './syncQueue';

// ─── Raw senders (throw on failure) ──────────────────────────────────────────
async function sendOrder(order: any, cashierName?: string): Promise<void> {
  await set(ref(db, `pos_orders/${order.order_number}`), {
    id:             order.id,
    order_number:   order.order_number,
    status:         order.status,
    payment_method: order.payment_method,
    subtotal:       order.subtotal ?? 0,
    discount:       order.discount ?? 0,
    total:          order.total,
    notes:          order.notes ?? null,
    cashier_name:   cashierName ?? order.cashier_name ?? 'Cashier',
    created_at:     order.created_at,
    items:          (order.items ?? []).map((i: any) => ({
      menu_item_id: i.menu_item_id,
      name:         i.name,
      price:        i.price,
      qty:          i.qty,
      subtotal:     i.subtotal,
      notes:        i.notes ?? null,
      emoji:        i.emoji ?? '🍽️',
    })),
  });
}

async function sendVoid(orderNumber: string, reason: string): Promise<void> {
  await update(ref(db, `pos_orders/${orderNumber}`), {
    status: 'voided', notes: `VOID: ${reason}`,
  });
}

// Stock-only write (sales, voids, restocks, waste). Deliberately does NOT send
// name/price/emoji/category: this device's copy of those may be stale, and a
// full overwrite here used to revert edits made from the web admin. Also used
// for old full-snapshot ops still sitting in the outbox, which downgrades them
// to stock-only on replay.
async function sendStock(item: any): Promise<void> {
  await update(ref(db, `pos_stock/${item.id}`), {
    id: item.id, stock: item.stock, is_available: item.is_available,
  });
}

// Full record write — only when the item itself was created/edited here.
async function sendStockFull(item: any): Promise<void> {
  await set(ref(db, `pos_stock/${item.id}`), {
    id: item.id, name: item.name, emoji: item.emoji, price: item.price,
    category_id: item.category_id, category_name: item.category_name,
    stock: item.stock, is_available: item.is_available,
  });
}

async function sendMenu(id: number, data: any): Promise<void> {
  await update(ref(db, `pos_menu/${id}`), { id, ...data });
}

// ─── Public pushes (best-effort, queue on failure for offline retry) ─────────
export async function pushOrder(order: Order, cashierName?: string): Promise<void> {
  try { await sendOrder(order, cashierName); }
  catch { await enqueue({ type: 'order', order, cashierName }); }
}

export async function pushVoid(orderNumber: string, reason: string): Promise<void> {
  try { await sendVoid(orderNumber, reason); }
  catch { await enqueue({ type: 'void', orderNumber, reason }); }
}

export async function pushStock(item: StockItem): Promise<void> {
  try { await sendStock(item); }
  catch { await enqueue({ type: 'stock', item }); }
}

export async function pushStockFull(item: StockItem): Promise<void> {
  try { await sendStockFull(item); }
  catch { await enqueue({ type: 'stock_full', item }); }
}

export async function pushStockBulk(items: StockItem[]): Promise<void> {
  await Promise.allSettled(items.map(pushStock));
}

export async function pushMenuItem(id: number, data: { is_available?: boolean; price?: number; name?: string; emoji?: string }): Promise<void> {
  try { await sendMenu(id, data); }
  catch { await enqueue({ type: 'menu', id, data }); }
}

// Fill pos_menu entries that are missing in the cloud (e.g. pos_menu was
// cleared). Never overwrites existing entries — this device's names/prices
// may be stale, and re-pushing all of them used to undo web-admin edits.
export async function seedMissingMenu(items: { id: number; is_available: boolean; price: number; name: string; emoji: string }[]): Promise<void> {
  try {
    const snap = await get(ref(db, 'pos_menu'));
    const existing = snap.val() ?? {};
    const updates: Record<string, any> = {};
    for (const i of items) {
      if (existing[i.id]) continue;
      updates[`pos_menu/${i.id}`] = { id: i.id, is_available: i.is_available, price: i.price, name: i.name, emoji: i.emoji };
    }
    if (Object.keys(updates).length) await update(ref(db), updates);
  } catch (e) { console.warn('[Sync] seedMissingMenu failed:', e); }
}

// ─── Flush outbox (call when connectivity returns) ───────────────────────────
export async function flushPendingSyncs(): Promise<number> {
  return flushQueue({ sendOrder, sendVoid, sendStock, sendStockFull, sendMenu });
}

// ─── Clear all orders (owner reset) ──────────────────────────────────────────
export async function clearFirebaseOrders(): Promise<void> {
  await set(ref(db, 'pos_orders'), null);
}

// ─── Remove a menu item everywhere (on delete) ───────────────────────────────
export async function removeMenuItem(id: number): Promise<void> {
  try {
    await Promise.all([
      set(ref(db, `pos_menu/${id}`), null),
      set(ref(db, `pos_stock/${id}`), null),
    ]);
  } catch (e) { console.warn('[Sync] removeMenuItem failed:', e); }
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
    // A stock-only write for an item deleted elsewhere leaves a nameless
    // {id, stock, is_available} stub — treat it as deleted, not as an item.
    onData((Object.values(val) as StockItem[]).filter(i => i && i.name));
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
