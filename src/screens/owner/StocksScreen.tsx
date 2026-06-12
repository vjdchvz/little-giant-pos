// src/screens/owner/StocksScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useStockStore } from '../../store';
import { stockAPI } from '../../services/localApi';
import { Ingredient } from '../../types';

// ─── Mock fallback ───────────────────────────────────────────────────────────
const MOCK_INGREDIENTS: Ingredient[] = [
  { id: 1, name: 'Rice', unit: 'cups', qty: 50, max_qty: 80, low_threshold: 10, cost_per_unit: 2.5, stock_pct: 62.5, is_low: false },
  { id: 2, name: 'Egg', unit: 'pieces', qty: 8, max_qty: 60, low_threshold: 10, cost_per_unit: 7, stock_pct: 13.3, is_low: true },
  { id: 3, name: 'Beef (tapsilog)', unit: 'grams', qty: 250, max_qty: 2000, low_threshold: 300, cost_per_unit: 0.8, stock_pct: 12.5, is_low: true },
  { id: 7, name: 'Chicken BBQ', unit: 'sticks', qty: 30, max_qty: 50, low_threshold: 8, cost_per_unit: 25, stock_pct: 60, is_low: false },
  { id: 8, name: 'Pork BBQ', unit: 'sticks', qty: 25, max_qty: 50, low_threshold: 8, cost_per_unit: 20, stock_pct: 50, is_low: false },
  { id: 11, name: 'Fishball', unit: 'pieces', qty: 80, max_qty: 150, low_threshold: 20, cost_per_unit: 1.5, stock_pct: 53.3, is_low: false },
  { id: 18, name: 'Softdrinks (can)', unit: 'cans', qty: 4, max_qty: 48, low_threshold: 6, cost_per_unit: 22, stock_pct: 8.3, is_low: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function barColor(pct: number): string {
  if (pct <= 20) return Colors.danger;
  if (pct <= 40) return Colors.warning;
  return Colors.success;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
type ModalMode = 'restock' | 'waste' | null;

interface ActionModalProps {
  mode: ModalMode;
  ingredient: Ingredient | null;
  onClose: () => void;
  onSubmit: (qty: number, note: string) => Promise<void>;
}

function ActionModal({ mode, ingredient, onClose, onSubmit }: ActionModalProps) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRestock = mode === 'restock';
  const title = isRestock ? 'Restock' : 'Log Waste';
  const btnColor = isRestock ? Colors.success : Colors.danger;

  const handleSubmit = async () => {
    const n = parseFloat(qty);
    if (!n || n <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit(n, note);
      setQty('');
      setNote('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={!!mode} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title} — {ingredient?.name}</Text>
          <Text style={styles.modalSub}>Current: {ingredient?.qty} {ingredient?.unit}</Text>

          <Text style={styles.inputLabel}>Quantity ({ingredient?.unit})</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            keyboardType="numeric"
            value={qty}
            onChangeText={setQty}
            autoFocus
          />

          <Text style={styles.inputLabel}>{isRestock ? 'Note (optional)' : 'Reason'}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder={isRestock ? 'Supplier, batch, etc.' : 'Dropped, expired, etc.'}
            value={note}
            onChangeText={setNote}
            multiline
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: btnColor }, (!qty || submitting) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!qty || submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.submitBtnText}>{title}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Ingredient Row ──────────────────────────────────────────────────────────
function IngredientRow({ item, onRestock, onWaste }: {
  item: Ingredient;
  onRestock: () => void;
  onWaste: () => void;
}) {
  const pct = Math.min(item.stock_pct, 100);
  const color = barColor(pct);

  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientHeader}>
        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientName}>{item.name}</Text>
          <Text style={styles.ingredientQty}>
            {item.qty} / {item.max_qty} {item.unit}
          </Text>
        </View>
        {item.is_low && (
          <View style={styles.lowBadge}>
            <Ionicons name="warning-outline" size={11} color={Colors.warning} />
            <Text style={styles.lowBadgeText}>Low</Text>
          </View>
        )}
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>

      <View style={styles.ingredientActions}>
        <TouchableOpacity style={styles.restockBtn} onPress={onRestock}>
          <Ionicons name="add-circle-outline" size={14} color={Colors.success} />
          <Text style={styles.restockBtnText}>Restock</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.wasteBtn} onPress={onWaste}>
          <Ionicons name="trash-outline" size={14} color={Colors.danger} />
          <Text style={styles.wasteBtnText}>Waste</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function StocksScreen() {
  const { ingredients, setIngredients, lowStockItems } = useStockStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<{ mode: ModalMode; item: Ingredient | null }>({ mode: null, item: null });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const data = await stockAPI.getAll();
      setIngredients(data);
    } catch {
      if (ingredients.length === 0) setIngredients(MOCK_INGREDIENTS);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ingredients.length, setIngredients]);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const openModal = (mode: ModalMode, item: Ingredient) => setModal({ mode, item });
  const closeModal = () => setModal({ mode: null, item: null });

  const handleSubmit = async (qty: number, note: string) => {
    if (!modal.item || !modal.mode) return;
    const id = modal.item.id;
    if (modal.mode === 'restock') {
      await stockAPI.restock(id, qty, note);
    } else {
      await stockAPI.logWaste(id, qty, note || 'No reason');
    }
    await load(true);
  };

  const lowItems = lowStockItems();

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>Stocks</Text>
        {error && (
          <View style={styles.offlinePill}>
            <Ionicons name="cloud-offline-outline" size={12} color={Colors.warning} />
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Low stock banner */}
        {lowItems.length > 0 && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={16} color={Colors.warning} />
            <Text style={styles.alertText}>
              {lowItems.length} item{lowItems.length > 1 ? 's' : ''} running low:{' '}
              {lowItems.map(i => i.name).join(', ')}
            </Text>
          </View>
        )}

        {/* Ingredients list */}
        <View style={styles.listCard}>
          {ingredients.map((item, i) => (
            <React.Fragment key={item.id}>
              {i > 0 && <View style={styles.divider} />}
              <IngredientRow
                item={item}
                onRestock={() => openModal('restock', item)}
                onWaste={() => openModal('waste', item)}
              />
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      <ActionModal
        mode={modal.mode}
        ingredient={modal.item}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSecondary },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  screenTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  offlineText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.warningLight, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  alertText: { flex: 1, fontSize: Typography.sm, color: Colors.warning, fontWeight: Typography.medium },

  listCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  divider: { height: 0.5, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  ingredientRow: { padding: Spacing.lg },
  ingredientHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  ingredientInfo: { flex: 1 },
  ingredientName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  ingredientQty: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  lowBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warningLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  lowBadgeText: { fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.bold },

  barTrack: { height: 6, backgroundColor: Colors.gray100, borderRadius: Radius.full, overflow: 'hidden', marginBottom: Spacing.md },
  barFill: { height: '100%', borderRadius: Radius.full },

  ingredientActions: { flexDirection: 'row', gap: Spacing.sm },
  restockBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  restockBtnText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.success },
  wasteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dangerLight, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  wasteBtnText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.danger },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.xl },
  inputLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary, marginBottom: Spacing.lg },
  inputMulti: { height: 72, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },
  submitBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  submitBtnText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
  btnDisabled: { opacity: 0.5 },
});
