// src/screens/owner/DashboardScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { format } from 'date-fns';

import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useDashboardStore } from '../../store';
import { reportsAPI, ordersAPI } from '../../services/api';
import { DailySummary, Order, TopItem, PaymentMethod } from '../../types';

const SCREEN_W = Dimensions.get('window').width;

// ─── Mock fallback ───────────────────────────────────────────────────────────
const MOCK_SUMMARY: DailySummary = {
  date: new Date().toISOString().split('T')[0],
  gross_sales: 4250,
  total_orders: 38,
  avg_order_value: 111.84,
  top_items: [
    { menu_item_id: 1, name: 'Tapsilog', emoji: '🍳', qty_sold: 12, revenue: 1068 },
    { menu_item_id: 5, name: 'Chicken BBQ', emoji: '🍗', qty_sold: 18, revenue: 1350 },
    { menu_item_id: 6, name: 'Pork BBQ', emoji: '🥩', qty_sold: 15, revenue: 975 },
    { menu_item_id: 10, name: "Sago't Gulaman", emoji: '🧉', qty_sold: 22, revenue: 550 },
    { menu_item_id: 2, name: 'Longsilog', emoji: '🌭', qty_sold: 8, revenue: 632 },
  ],
  payment_breakdown: { cash: 2800, gcash: 950, maya: 500 },
  low_stock_count: 2,
};

const MOCK_ORDERS: Order[] = [
  { id: 38, order_number: 'LG-038', status: 'completed', payment_method: 'gcash', subtotal: 164, discount: 0, total: 164, items: [], created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 37, order_number: 'LG-037', status: 'completed', payment_method: 'cash', subtotal: 89, discount: 0, total: 89, items: [], created_at: new Date(Date.now() - 18 * 60000).toISOString() },
  { id: 36, order_number: 'LG-036', status: 'completed', payment_method: 'maya', subtotal: 120, discount: 0, total: 120, items: [], created_at: new Date(Date.now() - 34 * 60000).toISOString() },
  { id: 35, order_number: 'LG-035', status: 'completed', payment_method: 'cash', subtotal: 75, discount: 0, total: 75, items: [], created_at: new Date(Date.now() - 52 * 60000).toISOString() },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(isoString: string): string {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash: Colors.success,
  gcash: '#0070F3',
  maya: '#00B140',
};

// ─── Sub-components ──────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  return (
    <View style={[styles.badge, { backgroundColor: PAYMENT_COLORS[method] + '20' }]}>
      <Text style={[styles.badgeText, { color: PAYMENT_COLORS[method] }]}>
        {method.toUpperCase()}
      </Text>
    </View>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <View style={styles.orderRow}>
      <View style={styles.orderLeft}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <Text style={styles.orderTime}>{timeAgo(order.created_at)}</Text>
      </View>
      <PaymentBadge method={order.payment_method} />
      <Text style={styles.orderTotal}>{formatPeso(order.total)}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { summary, recentOrders, setSummary, setRecentOrders } = useDashboardStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const [s, orders] = await Promise.all([
        reportsAPI.getDaily(),
        ordersAPI.getRecent(20),
      ]);
      setSummary(s);
      setRecentOrders(orders);
    } catch {
      // fallback to mock data so cashier can still operate
      if (!summary) {
        setSummary(MOCK_SUMMARY);
        setRecentOrders(MOCK_ORDERS);
      }
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [summary, setSummary, setRecentOrders]);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const bestSeller = summary?.top_items?.[0];

  // chart data
  const chartItems = (summary?.top_items ?? []).slice(0, 5);
  const chartData = {
    labels: chartItems.map(i => i.name.split(' ')[0]),
    datasets: [{ data: chartItems.map(i => i.revenue) }],
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.storeName}>Little Giant POS</Text>
            <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
          {error && (
            <View style={styles.offlinePill}>
              <Ionicons name="cloud-offline-outline" size={12} color={Colors.warning} />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>

        {/* Metrics 2×2 */}
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Gross Sales"
            value={formatPeso(summary?.gross_sales ?? 0)}
            color={Colors.success}
          />
          <MetricCard
            label="Total Orders"
            value={String(summary?.total_orders ?? 0)}
          />
          <MetricCard
            label="Avg Order"
            value={formatPeso(summary?.avg_order_value ?? 0)}
          />
          <MetricCard
            label="Best Seller"
            value={bestSeller ? `${bestSeller.emoji} ${bestSeller.name}` : '—'}
            sub={bestSeller ? `${bestSeller.qty_sold} sold` : undefined}
          />
        </View>

        {/* Payment Breakdown */}
        {summary?.payment_breakdown && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.paymentRow}>
              {(['cash', 'gcash', 'maya'] as PaymentMethod[]).map(m => (
                <View key={m} style={styles.paymentCard}>
                  <Text style={[styles.paymentMethod, { color: PAYMENT_COLORS[m] }]}>{m.toUpperCase()}</Text>
                  <Text style={styles.paymentAmount}>{formatPeso(summary.payment_breakdown[m])}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Items Bar Chart */}
        {chartItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Items by Revenue</Text>
            <View style={styles.chartCard}>
              <BarChart
                data={chartData}
                width={SCREEN_W - Spacing.lg * 4}
                height={180}
                yAxisLabel="₱"
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: Colors.white,
                  backgroundGradientFrom: Colors.white,
                  backgroundGradientTo: Colors.white,
                  decimalPlaces: 0,
                  color: () => Colors.primary,
                  labelColor: () => Colors.textSecondary,
                  propsForLabels: { fontSize: 11 },
                }}
                style={{ borderRadius: Radius.md }}
                showValuesOnTopOfBars
                fromZero
              />
            </View>
          </View>
        )}

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <View style={styles.card}>
            {recentOrders.length === 0 ? (
              <Text style={styles.emptyText}>No orders yet today</Text>
            ) : (
              recentOrders.slice(0, 10).map((o, i) => (
                <React.Fragment key={o.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <OrderRow order={o} />
                </React.Fragment>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSecondary },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
  storeName: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  dateLabel: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  offlineText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  metricCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.white,
    borderRadius: Radius.lg, padding: Spacing.lg, ...Shadow.sm,
  },
  metricLabel: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium, marginBottom: Spacing.xs },
  metricValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  metricSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  chartCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },

  paymentRow: { flexDirection: 'row', gap: Spacing.md },
  paymentCard: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  paymentMethod: { fontSize: Typography.xs, fontWeight: Typography.bold },
  paymentAmount: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: 4 },

  orderRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  orderLeft: { flex: 1 },
  orderNumber: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  orderTime: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  orderTotal: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: Typography.xs, fontWeight: Typography.bold },
  divider: { height: 0.5, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  emptyText: { textAlign: 'center', color: Colors.textMuted, padding: Spacing.xl },
});
