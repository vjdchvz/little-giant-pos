// src/services/api.ts
// Little Giant POS — API Service

import axios from 'axios';
import { MenuItem, Ingredient, Order, CartItem, PaymentMethod, DailySummary } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Menu ────────────────────────────────────
export const menuAPI = {
  getAll: (): Promise<MenuItem[]> =>
    api.get('/menu/items').then(r => r.data),

  getCategories: () =>
    api.get('/menu/categories').then(r => r.data),

  updateAvailability: (id: number, is_available: boolean) =>
    api.patch(`/menu/items/${id}`, { is_available }).then(r => r.data),
};

// ─── Orders ──────────────────────────────────
export const ordersAPI = {
  create: (payload: {
    items: CartItem[];
    payment_method: PaymentMethod;
    discount?: number;
    cashier_name?: string;
    notes?: string;
  }): Promise<Order> =>
    api.post('/orders', payload).then(r => r.data),

  getRecent: (limit = 20): Promise<Order[]> =>
    api.get(`/orders/recent?limit=${limit}`).then(r => r.data),

  getById: (id: number): Promise<Order> =>
    api.get(`/orders/${id}`).then(r => r.data),

  void: (id: number, reason: string): Promise<Order> =>
    api.patch(`/orders/${id}/void`, { reason }).then(r => r.data),
};

// ─── Ingredients / Stock ─────────────────────
export const stockAPI = {
  getAll: (): Promise<Ingredient[]> =>
    api.get('/ingredients').then(r => r.data),

  restock: (id: number, qty: number, note?: string) =>
    api.post(`/ingredients/${id}/restock`, { qty, note }).then(r => r.data),

  logWaste: (id: number, qty: number, reason: string) =>
    api.post(`/ingredients/${id}/waste`, { qty, reason }).then(r => r.data),

  adjust: (id: number, qty: number, note: string) =>
    api.post(`/ingredients/${id}/adjust`, { qty, note }).then(r => r.data),
};

// ─── Reports ─────────────────────────────────
export const reportsAPI = {
  getDaily: (date?: string): Promise<DailySummary> =>
    api.get(`/reports/daily${date ? `?date=${date}` : ''}`).then(r => r.data),

  getWeekly: () =>
    api.get('/reports/weekly').then(r => r.data),

  getHourly: (date?: string) =>
    api.get(`/reports/hourly${date ? `?date=${date}` : ''}`).then(r => r.data),
};

// ─── AI ──────────────────────────────────────
export const aiAPI = {
  chat: (message: string, history: { role: string; content: string }[]) =>
    api.post('/ai/chat', { message, history }).then(r => r.data),

  generateEOD: () =>
    api.post('/ai/eod-report').then(r => r.data),

  getForecast: () =>
    api.get('/ai/forecast').then(r => r.data),
};

export default api;
