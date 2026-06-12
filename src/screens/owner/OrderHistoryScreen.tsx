// src/screens/owner/OrderHistoryScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { ordersAPI } from '../../services/localApi';
import { Order, PaymentMethod } from '../../types';

const PAY_COLORS: Record<PaymentMethod, string> = {
  cash: Colors.success, gcash: '#0070F3', maya: '#00B140',
};

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeStr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────
function ReceiptModal({ order, onClose, onVoid }: {
  order: Order | null; onClose: () => void; onVoid: (id: number, reason: string) => Promise<void>;
}) {
  const [voidMode, setVoidMode] = useState(false);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  useEffect(() => { if (!order) { setVoidMode(false); setReason(''); } }, [order]);

  const handleVoid = async () => {
    if (!order || !reason.trim()) return;
    setVoiding(true);
    try {
      await onVoid(order.id, reason.trim());
      onClose();
    } finally { setVoiding(false); }
  };

  if (!order) return null;
  const isVoided = order.status === 'voided';

  return (
    <Modal visible={!!order} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{order.order_number}</Text>
            {isVoided && <View style={styles.voidedBadge}><Text style={styles.voidedBadgeText}>VOIDED</Text></View>}
          </View>
          <Text style={styles.modalTime}>{timeStr(order.created_at)}</Text>

          {/* Items */}
          {order.items.map((item, i) => (
            <View key={i} style={styles.receiptRow}>
              <Text style={styles.receiptItemName}>{item.qty}× {item.name}</Text>
              {item.notes ? <Text style={styles.receiptItemNote}>📝 {item.notes}</Text> : null}
              <Text style={styles.receiptItemAmt}>{formatPeso(item.subtotal)}</Text>
            </View>
          ))}

          <View style={styles.receiptDivider} />
          <View style={styles.receiptRow}>
            <Text style={styles.receiptTotalLabel}>Total</Text>
            <Text style={styles.receiptTotal}>{formatPeso(order.total)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptMeta}>Payment</Text>
            <Text style={[styles.receiptMeta, { color: PAY_COLORS[order.payment_method] }]}>
              {order.payment_method.toUpperCase()}
            </Text>
          </View>
          {order.notes ? <Text style={styles.receiptNotes}>{order.notes}</Text> : null}

          {!isVoided && (
            voidMode ? (
              <View style={styles.voidBox}>
                <Text style={styles.voidLabel}>Reason for void</Text>
                <TextInput
                  style={styles.voidInput}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. customer cancelled, wrong order..."
                  autoFocus
                />
                <View style={styles.voidBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setVoidMode(false)}>
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.voidConfirmBtn, (!reason.trim() || voiding) && { opacity: 0.5 }]}
                    onPress={handleVoid}
                    disabled={!reason.trim() || voiding}
                  >
                    {voiding
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Text style={styles.voidConfirmText}>Confirm Void</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.voidBtn} onPress={() => setVoidMode(true)}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                <Text style={styles.voidBtnText}>Void Order</Text>
              </TouchableOpacity>
            )
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────
function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const isVoided = order.status === 'voided';
  return (
    <TouchableOpacity style={[styles.orderRow, isVoided && styles.orderRowVoided]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.orderLeft}>
        <Text style={styles.orderNum}>{order.order_number}</Text>
        <Text style={styles.orderTime}>{timeStr(order.created_at)}</Text>
        <Text style={styles.orderItemCount}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</Text>
      </View>
      <View style={styles.orderRight}>
        {isVoided ? (
          <Text style={styles.voidedText}>VOID</Text>
        ) : (
          <>
            <View style={[styles.payBadge, { backgroundColor: PAY_COLORS[order.payment_method] + '20' }]}>
              <Text style={[styles.payBadgeText, { color: PAY_COLORS[order.payment_method] }]}>
                {order.payment_method.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.orderTotal}>{formatPeso(order.total)}</Text>
          </>
        )}
        <Ionicons name="chevron-forward" size={14} color={Colors.gray300} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await ordersAPI.getHistory(200);
      setOrders(data);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const handleVoid = async (id: number, reason: string) => {
    await ordersAPI.void(id, reason);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'voided' as const, notes: `VOID: ${reason}` } : o));
  };

  const openOrder = async (order: Order) => {
    // Load full order with items if not already loaded
    if (order.items.length === 0) {
      try {
        const full = await ordersAPI.getById(order.id);
        setSelectedOrder(full);
      } catch { setSelectedOrder(order); }
    } else {
      setSelectedOrder(order);
    }
  };

  const totalSales = orders.filter(o => o.status !== 'voided').reduce((s, o) => s + o.total, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerBar}><Text style={styles.screenTitle}>Order History</Text></View>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>Order History</Text>
        <Text style={styles.headerSub}>{orders.length} orders</Text>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Completed</Text>
          <Text style={styles.summaryVal}>{orders.filter(o => o.status !== 'voided').length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Voided</Text>
          <Text style={[styles.summaryVal, { color: Colors.danger }]}>{orders.filter(o => o.status === 'voided').length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Sales</Text>
          <Text style={[styles.summaryVal, { color: Colors.success }]}>{formatPeso(totalSales)}</Text>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={o => String(o.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.primary} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => <OrderRow order={item} onPress={() => openOrder(item)} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No orders yet</Text>}
      />

      <ReceiptModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onVoid={handleVoid}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bgSecondary },
  centered:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  screenTitle:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerSub:        { fontSize: Typography.xs, color: Colors.textMuted },

  summaryStrip:     { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  summaryItem:      { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  summaryLabel:     { fontSize: Typography.xs, color: Colors.textMuted },
  summaryVal:       { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary, marginTop: 2 },

  list:             { paddingBottom: Spacing.xxxl },
  divider:          { height: 0.5, backgroundColor: Colors.border },

  orderRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  orderRowVoided:   { opacity: 0.5 },
  orderLeft:        { flex: 1 },
  orderNum:         { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  orderTime:        { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  orderItemCount:   { fontSize: Typography.xs, color: Colors.textMuted },
  orderRight:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  payBadge:         { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  payBadgeText:     { fontSize: Typography.xs, fontWeight: Typography.bold },
  orderTotal:       { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  voidedText:       { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.danger },
  emptyText:        { textAlign: 'center', color: Colors.textMuted, padding: Spacing.xxxl },

  // Modal
  modalOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:       { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxxl, maxHeight: '85%' },
  modalHandle:      { width: 36, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: 4 },
  modalTitle:       { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalTime:        { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: Spacing.lg },
  voidedBadge:      { backgroundColor: Colors.dangerLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  voidedBadgeText:  { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.danger },

  receiptRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  receiptItemName:  { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  receiptItemNote:  { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic' },
  receiptItemAmt:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  receiptDivider:   { height: 0.5, backgroundColor: Colors.border, marginVertical: Spacing.md },
  receiptTotalLabel:{ fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  receiptTotal:     { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.success },
  receiptMeta:      { fontSize: Typography.sm, color: Colors.textMuted },
  receiptNotes:     { fontSize: Typography.xs, color: Colors.textMuted, fontStyle: 'italic', marginTop: Spacing.sm },

  voidBox:          { marginTop: Spacing.lg, padding: Spacing.md, backgroundColor: Colors.dangerLight, borderRadius: Radius.md, gap: Spacing.md },
  voidLabel:        { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.danger },
  voidInput:        { backgroundColor: Colors.white, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.sm, color: Colors.textPrimary },
  voidBtns:         { flexDirection: 'row', gap: Spacing.md },
  voidConfirmBtn:   { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.danger, alignItems: 'center' },
  voidConfirmText:  { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.white },

  voidBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.danger },
  voidBtnText:      { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.danger },

  closeBtn:         { marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.bgSecondary, alignItems: 'center' },
  closeBtnText:     { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },

  cancelBtn:        { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.white, alignItems: 'center' },
  cancelBtnText:    { fontSize: Typography.sm, color: Colors.textSecondary },
});
