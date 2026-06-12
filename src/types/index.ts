// src/types/index.ts
// Little Giant POS — Shared Types

// ─── Menu ───────────────────────────────────
export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  price: number;
  emoji: string;
  description?: string;
  is_available: boolean;
  servings_left?: number; // computed from stock
}

// ─── Ingredients / Stock ────────────────────
export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  qty: number;
  max_qty: number;
  low_threshold: number;
  cost_per_unit: number;
  stock_pct: number; // computed: qty/max_qty * 100
  is_low: boolean;   // computed: qty <= low_threshold
}

export interface Recipe {
  menu_item_id: number;
  ingredient_id: number;
  ingredient_name: string;
  qty_per_order: number;
  unit: string;
}

// ─── Cart ───────────────────────────────────
export interface CartItem {
  menu_item_id: number;
  name: string;
  price: number;
  emoji: string;
  qty: number;
  subtotal: number;
  notes?: string;
}

// ─── Orders ─────────────────────────────────
export type PaymentMethod = 'cash' | 'gcash' | 'maya';
export type OrderStatus = 'pending' | 'completed' | 'voided';

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  items: OrderItem[];
  cashier_name?: string;
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  name: string;
  price: number;
  qty: number;
  subtotal: number;
  notes?: string;
}

// ─── Reports / Analytics ────────────────────
export interface DailySummary {
  date: string;
  gross_sales: number;
  total_orders: number;
  avg_order_value: number;
  top_items: TopItem[];
  payment_breakdown: PaymentBreakdown;
  low_stock_count: number;
}

export interface TopItem {
  menu_item_id: number;
  name: string;
  emoji: string;
  qty_sold: number;
  revenue: number;
}

export interface PaymentBreakdown {
  cash: number;
  gcash: number;
  maya: number;
}

export interface HourlySales {
  hour: number; // 0-23
  total: number;
  orders: number;
}

// ─── AI ─────────────────────────────────────
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Navigation ─────────────────────────────
export type RootTabParamList = {
  Cashier: undefined;
  Dashboard: undefined;
  Stocks: undefined;
  History: undefined;
  Settings: undefined;
};

export type CashierStackParamList = {
  Menu: undefined;
  Cart: undefined;
  Payment: { total: number };
  OrderSuccess: { order: Order };
};
