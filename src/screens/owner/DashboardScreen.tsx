// src/screens/owner/DashboardScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { format } from 'date-fns';

import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useDashboardStore } from '../../store';
import { reportsAPI, ordersAPI, ReportPeriod } from '../../services/localApi';
import { DailySummary, Order, PaymentMethod } from '../../types';

const SCREEN_W = Dimensions.get('window').width;

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'day',   label: 'Today'  },
  { key: 'week',  label: 'Week'   },
  { key: 'month', label: 'Month'  },
  { key: 'year',  label: 'Year'   },
];

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const PAY_COLORS: Record<PaymentMethod, string> = {
  cash: Colors.success,
  gcash: '#0070F3',
  maya: '#00B140',
};

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <View style={styles.orderRow}>
      <View style={styles.orderLeft}>
        <Text style={styles.orderNum}>{order.order_number}</Text>
        <Text style={styles.orderTime}>{timeAgo(order.created_at)}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: PAY_COLORS[order.payment_method] + '20' }]}>
        <Text style={[styles.badgeText, { color: PAY_COLORS[order.payment_method] }]}>
          {order.payment_method.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.orderTotal}>{formatPeso(order.total)}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { summary, recentOrders, setSummary, setRecentOrders } = useDashboardStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>('day');

  const load = useCallback(async (p: ReportPeriod, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [s, orders] = await Promise.all([
        reportsAPI.getSummary(p),
        ordersAPI.getRecent(20),
      ]);
      setSummary(s);
      setRecentOrders(orders);
    } catch {
      /* keep existing state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setSummary, setRecentOrders]);

  useEffect(() => { load(period); }, [period]);

  const onRefresh = () => { setRefreshing(true); load(period, true); };

  const bestSeller = summary?.top_items?.[0];
  const chartItems = (summary?.top_items ?? []).slice(0, 5);
  const chartData = {
    labels: chartItems.map(i => i.name.split(' ')[0].substring(0, 6)),
    datasets: [{ data: chartItems.length > 0 ? chartItems.map(i => i.revenue) : [0] }],
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.storeName}>Little Giant POS</Text>
          <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Metrics 2×2 */}
        <View style={styles.metricsGrid}>
          <MetricCard label="Gross Sales"   value={formatPeso(summary?.gross_sales ?? 0)}      color={Colors.success} />
          <MetricCard label="Total Orders"  value={String(summary?.total_orders ?? 0)} />
          <MetricCard label="Avg Order"     value={formatPeso(summary?.avg_order_value ?? 0)} />
          <MetricCard
            label="Best Seller"
            value={bestSeller ? `${bestSeller.emoji} ${bestSeller.name.split(' ')[0]}` : '—'}
            sub={bestSeller ? `${bestSeller.qty_sold} sold · ${formatPeso(bestSeller.revenue)}` : undefined}
          />
        </View>

        {/* Payment Breakdown */}
        {summary?.payment_breakdown && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.paymentRow}>
              {(['cash', 'gcash', 'maya'] as PaymentMethod[]).map(m => (
                <View key={m} style={styles.paymentCard}>
                  <Text style={[styles.paymentMethod, { color: PAY_COLORS[m] }]}>{m.toUpperCase()}</Text>
                  <Text style={styles.paymentAmount}>{formatPeso(summary.payment_breakdown[m] ?? 0)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Items Chart */}
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
                  propsForLabels: { fontSize: 10 },
                }}
                style={{ borderRadius: Radius.md }}
                showValuesOnTopOfBars
                fromZero
              />
            </View>
          </View>
        )}

        {/* Top Items list */}
        {chartItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Sellers</Text>
            <View style={styles.card}>
              {chartItems.map((item, i) => (
                <React.Fragment key={item.menu_item_id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.topItemRow}>
                    <Text style={styles.topItemRank}>#{i + 1}</Text>
                    <Text style={styles.topItemEmoji}>{item.emoji}</Text>
                    <Text style={styles.topItemName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.topItemRight}>
                      <Text style={styles.topItemQty}>{item.qty_sold} sold</Text>
                      <Text style={styles.topItemRev}>{formatPeso(item.revenue)}</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Recent Orders — only show for 'day' period */}
        {period === 'day' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <View style={styles.card}>
              {recentOrders.length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bgSecondary },
  centered:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSecondary },

  header:            { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  storeName:         { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  dateLabel:         { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },

  periodRow:         { flexDirection: 'row', backgroundColor: Colors.white, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  periodBtn:         { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.bgSecondary },
  periodBtnActive:   { backgroundColor: Colors.primary },
  periodBtnText:     { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textMuted },
  periodBtnTextActive: { color: Colors.white },

  scroll:            { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  metricsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  metricCard:        { flex: 1, minWidth: '45%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, ...Shadow.sm },
  metricLabel:       { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium, marginBottom: Spacing.xs },
  metricValue:       { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  metricSub:         { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  section:           { marginBottom: Spacing.xl },
  sectionTitle:      { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  card:              { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  chartCard:         { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },

  paymentRow:        { flexDirection: 'row', gap: Spacing.md },
  paymentCard:       { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  paymentMethod:     { fontSize: Typography.xs, fontWeight: Typography.bold },
  paymentAmount:     { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: 4 },

  topItemRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, gap: Spacing.sm },
  topItemRank:       { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textMuted, width: 24 },
  topItemEmoji:      { fontSize: 20 },
  topItemName:       { flex: 1, fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  topItemRight:      { alignItems: 'flex-end' },
  topItemQty:        { fontSize: Typography.xs, color: Colors.textMuted },
  topItemRev:        { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.success },

  orderRow:          { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  orderLeft:         { flex: 1 },
  orderNum:          { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  orderTime:         { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  orderTotal:        { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  badge:             { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  badgeText:         { fontSize: Typography.xs, fontWeight: Typography.bold },
  divider:           { height: 0.5, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  emptyText:         { textAlign: 'center', color: Colors.textMuted, padding: Spacing.xl },
});
