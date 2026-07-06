// src/hooks/useFirebaseSync.ts — full two-way real-time sync (offline-aware)
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { listenOrders, listenStock, listenMenu, flushPendingSyncs } from '../services/firebaseSync';
import { applyStockToSQLite, applyMenuToSQLite, applyOrdersToSQLite, archiveMissingLocally } from '../services/cloudSync';
import { useDashboardStore, useStockStore, useMenuStore } from '../store';
import { Order } from '../types';
import { StockItem } from '../services/localApi';

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
      archiveMissingLocally(items.map(i => i.id)); // mirror remote deletes locally
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

    // Offline outbox: flush queued writes on launch, when app returns to
    // foreground, and on a slow interval (covers reconnect while app is open).
    flushPendingSyncs();
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') flushPendingSyncs();
    });
    const flushTimer = setInterval(() => { flushPendingSyncs(); }, 30000);

    return () => {
      unsubOrders(); unsubStock(); unsubMenu();
      appSub.remove();
      clearInterval(flushTimer);
    };
  }, []);
}
