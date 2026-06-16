// src/store/index.ts
import { create } from 'zustand';
import { CartItem, MenuItem, Order, Ingredient, DailySummary } from '../types';

// ─── Cart Store ──────────────────────────────
interface CartStore {
  items: CartItem[];
  addItem: (item: MenuItem) => void;
  removeItem: (menu_item_id: number) => void;
  updateQty: (menu_item_id: number, qty: number) => void;
  setNotes: (menu_item_id: number, notes: string) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) => {
    const existing = get().items.find(i => i.menu_item_id === item.id);
    if (existing) {
      set(state => ({
        items: state.items.map(i =>
          i.menu_item_id === item.id
            ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price }
            : i
        ),
      }));
    } else {
      set(state => ({
        items: [...state.items, {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          emoji: item.emoji,
          qty: 1,
          subtotal: item.price,
        }],
      }));
    }
  },

  removeItem: (menu_item_id) => {
    set(state => ({ items: state.items.filter(i => i.menu_item_id !== menu_item_id) }));
  },

  updateQty: (menu_item_id, qty) => {
    if (qty <= 0) { get().removeItem(menu_item_id); return; }
    set(state => ({
      items: state.items.map(i =>
        i.menu_item_id === menu_item_id ? { ...i, qty, subtotal: qty * i.price } : i
      ),
    }));
  },

  setNotes: (menu_item_id, notes) => {
    set(state => ({
      items: state.items.map(i => i.menu_item_id === menu_item_id ? { ...i, notes } : i),
    }));
  },

  clearCart: () => set({ items: [] }),
  total: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),
  itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
}));

// ─── Menu Store ──────────────────────────────
interface MenuStore {
  items: MenuItem[];
  categories: string[];
  activeCategory: string;
  refreshToken: number;
  setItems: (items: MenuItem[]) => void;
  setActiveCategory: (cat: string) => void;
  filteredItems: () => MenuItem[];
  triggerRefresh: () => void;
}

export const useMenuStore = create<MenuStore>((set, get) => ({
  items: [],
  categories: ['All'],
  activeCategory: 'All',
  refreshToken: 0,
  setItems: (items) => {
    const cats = ['All', ...new Set(items.map(i => i.category_name || 'Other'))];
    set({ items, categories: cats });
  },
  setActiveCategory: (cat) => set({ activeCategory: cat }),
  filteredItems: () => {
    const { items, activeCategory } = get();
    if (activeCategory === 'All') return items;
    return items.filter(i => i.category_name === activeCategory);
  },
  triggerRefresh: () => set(s => ({ refreshToken: s.refreshToken + 1 })),
}));

// ─── Auth Store ───────────────────────────────
interface AuthStore {
  role: 'cashier' | 'owner' | null;
  deviceName: string;
  setAuth: (role: 'cashier' | 'owner', name: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  role: null,
  deviceName: 'Device',
  setAuth: (role, deviceName) => set({ role, deviceName }),
  logout: () => set({ role: null, deviceName: 'Device' }),
}));

// ─── Stock Store ─────────────────────────────
interface StockStore {
  ingredients: Ingredient[];
  setIngredients: (ingredients: Ingredient[]) => void;
  lowStockItems: () => Ingredient[];
}

export const useStockStore = create<StockStore>((set, get) => ({
  ingredients: [],
  setIngredients: (ingredients) => set({ ingredients }),
  lowStockItems: () => get().ingredients.filter(i => i.is_low),
}));

// ─── Dashboard Store ─────────────────────────
interface DashboardStore {
  summary: DailySummary | null;
  recentOrders: Order[];
  refreshToken: number;
  setSummary: (summary: DailySummary) => void;
  setRecentOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  triggerRefresh: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  summary: null,
  recentOrders: [],
  refreshToken: 0,
  setSummary: (summary) => set({ summary }),
  setRecentOrders: (orders) => set({ recentOrders: orders }),
  triggerRefresh: () => set(s => ({ refreshToken: s.refreshToken + 1 })),
  addOrder: (order) => set(state => ({
    recentOrders: [order, ...state.recentOrders].slice(0, 50),
    summary: state.summary ? {
      ...state.summary,
      gross_sales: state.summary.gross_sales + order.total,
      total_orders: state.summary.total_orders + 1,
    } : null,
    refreshToken: state.refreshToken + 1,
  })),
}));
