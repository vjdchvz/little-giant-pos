// src/services/syncQueue.ts — offline outbox: queue Firebase writes that fail
// while offline, then auto-flush them when connectivity returns.
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'sync_outbox_v1';

export type QueuedOp =
  | { type: 'order'; order: any; cashierName?: string }
  | { type: 'void'; orderNumber: string; reason: string }
  | { type: 'stock'; item: any }
  | { type: 'menu'; id: number; data: any };

let flushing = false;

async function readQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeQueue(ops: QueuedOp[]): Promise<void> {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops)); } catch {}
}

// Serialize enqueue calls — concurrent bulk operations (e.g. bulk restock of
// 147 items) can call enqueue() many times in parallel; without this chain,
// concurrent read-modify-write of the same AsyncStorage key drops entries.
let enqueueChain: Promise<void> = Promise.resolve();
export function enqueue(op: QueuedOp): Promise<void> {
  enqueueChain = enqueueChain.then(async () => {
    const ops = await readQueue();
    ops.push(op);
    await writeQueue(ops);
  });
  return enqueueChain;
}

export async function queueSize(): Promise<number> {
  return (await readQueue()).length;
}

// Attempt to flush all pending ops. Returns number still pending after the run.
// `senders` is injected to avoid a circular import with firebaseSync.
export async function flushQueue(senders: {
  sendOrder: (order: any, cashierName?: string) => Promise<void>;
  sendVoid: (orderNumber: string, reason: string) => Promise<void>;
  sendStock: (item: any) => Promise<void>;
  sendMenu: (id: number, data: any) => Promise<void>;
}): Promise<number> {
  if (flushing) return queueSize();
  flushing = true;
  try {
    let ops = await readQueue();
    if (ops.length === 0) return 0;

    const remaining: QueuedOp[] = [];
    for (const op of ops) {
      try {
        if (op.type === 'order')      await senders.sendOrder(op.order, op.cashierName);
        else if (op.type === 'void')  await senders.sendVoid(op.orderNumber, op.reason);
        else if (op.type === 'stock') await senders.sendStock(op.item);
        else if (op.type === 'menu')  await senders.sendMenu(op.id, op.data);
      } catch {
        remaining.push(op); // still offline — keep for next flush
      }
    }
    await writeQueue(remaining);
    return remaining.length;
  } finally {
    flushing = false;
  }
}
