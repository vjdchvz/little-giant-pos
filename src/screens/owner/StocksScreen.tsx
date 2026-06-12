// src/screens/owner/StocksScreen.tsx — per-item stock management
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput, Modal, KeyboardAvoidingView,
  Platform, ActivityIndicator, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow, CATEGORY_COLORS } from '../../theme';
import { stockAPI, StockItem } from '../../services/localApi';

// ─── Bulk Restock Modal ───────────────────────────────────────────────────────
function BulkRestockModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void; onSave: (qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (isNaN(n) || n <= 0) return;
    setSaving(true);
    try { await onSave(n); onClose(); setQty(''); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Bulk Restock All Items</Text>
          <Text style={styles.sheetSub}>Add this many servings to every item</Text>
          <Text style={styles.inputLabel}>Amount to add</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            autoFocus
            placeholder="e.g. 10"
          />
          <View style={styles.sheetBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.saveText}>Add to All</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Set-stock Modal ──────────────────────────────────────────────────────────
function SetStockModal({
  item, onClose, onSave,
}: {
  item: StockItem | null;
  onClose: () => void;
  onSave: (qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) setQty(String(item.stock));
  }, [item]);

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    try { await onSave(n); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Set Stock — {item?.name}</Text>
          <Text style={styles.sheetSub}>Current: {item?.stock} servings</Text>

          <Text style={styles.inputLabel}>New stock count</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            autoFocus
            placeholder="0"
          />

          <View style={styles.sheetBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.saveText}>Set Stock</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Stock Row ────────────────────────────────────────────────────────────────
function StockRow({ item, onSet, onAdd, onMinus }: {
  item: StockItem;
  onSet: () => void;
  onAdd: () => void;
  onMinus: () => void;
}) {
  const catColor = CATEGORY_COLORS[item.category_id] ?? Colors.primary;
  const isLow = item.stock <= 5;

  return (
    <View style={styles.row}>
      <View style={[styles.emojiBox, { backgroundColor: catColor + '20' }]}>
        <Text style={styles.rowEmoji}>{item.emoji}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.rowMeta}>
          {isLow && item.stock > 0 && (
            <View style={styles.lowBadge}>
              <Ionicons name="warning-outline" size={10} color={Colors.warning} />
              <Text style={styles.lowBadgeText}>Low</Text>
            </View>
          )}
          {item.stock === 0 && (
            <View style={[styles.lowBadge, { backgroundColor: Colors.dangerLight }]}>
              <Text style={[styles.lowBadgeText, { color: Colors.danger }]}>Out</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.qtyControl}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onMinus}>
          <Ionicons name="remove" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSet}>
          <Text style={[styles.qtyNum, isLow && { color: Colors.warning }]}>{item.stock}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qtyBtn} onPress={onAdd}>
          <Ionicons name="add" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StocksScreen() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showBulkRestock, setShowBulkRestock] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await stockAPI.getAll();
      setItems(data);
    } catch { /* keep existing */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const updateLocal = (id: number, stock: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, stock } : i));
  };

  const handleSet = async (qty: number) => {
    if (!editingItem) return;
    const updated = await stockAPI.setStock(editingItem.id, qty);
    updateLocal(updated.id, updated.stock);
  };

  const handleAdd = async (item: StockItem) => {
    const updated = await stockAPI.restock(item.id, 1);
    updateLocal(updated.id, updated.stock);
  };

  const handleMinus = async (item: StockItem) => {
    if (item.stock <= 0) return;
    const updated = await stockAPI.logWaste(item.id, 1);
    updateLocal(updated.id, updated.stock);
  };

  const handleBulkRestock = async (qty: number) => {
    for (const item of items) {
      await stockAPI.restock(item.id, qty);
    }
    await load(true);
  };

  // Group by category
  const sections = React.useMemo(() => {
    const map: Record<string, StockItem[]> = {};
    for (const item of items) {
      const key = item.category_name;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return Object.entries(map).map(([title, data]) => ({ title, data }));
  }, [items]);

  const lowCount = items.filter(i => i.stock <= 5).length;

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
        <View style={styles.headerActions}>
          <Text style={styles.headerSub}>{items.length} items · {lowCount} low</Text>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setShowBulkRestock(true)}>
            <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
            <Text style={styles.bulkBtnText}>Bulk Restock</Text>
          </TouchableOpacity>
        </View>
      </View>

      {lowCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={14} color={Colors.warning} />
          <Text style={styles.alertText}>{lowCount} item{lowCount > 1 ? 's' : ''} running low — tap the number to set stock</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={[styles.card, index === section.data.length - 1 && styles.cardLast]}>
            {index > 0 && <View style={styles.divider} />}
            <StockRow
              item={item}
              onSet={() => setEditingItem(item)}
              onAdd={() => handleAdd(item)}
              onMinus={() => handleMinus(item)}
            />
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: Spacing.md }} />}
      />

      <SetStockModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSet}
      />
      <BulkRestockModal
        visible={showBulkRestock}
        onClose={() => setShowBulkRestock(false)}
        onSave={handleBulkRestock}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bgSecondary },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSecondary },

  headerBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  screenTitle:   { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerSub:     { fontSize: Typography.xs, color: Colors.textMuted },
  bulkBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  bulkBtnText:   { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.primary },

  alertBanner:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.warning + '40' },
  alertText:    { flex: 1, fontSize: Typography.xs, color: Colors.warning, fontWeight: Typography.medium },

  listContent:  { paddingBottom: Spacing.xxxl },

  sectionHeader:{ backgroundColor: Colors.bgSecondary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  sectionTitle: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },

  card:         { backgroundColor: Colors.white },
  cardLast:     { borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md },
  divider:      { height: 0.5, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.md },
  emojiBox:     { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowEmoji:     { fontSize: 20 },
  rowInfo:      { flex: 1 },
  rowName:      { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  rowMeta:      { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  lowBadge:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.warningLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  lowBadgeText: { fontSize: 10, fontWeight: Typography.bold, color: Colors.warning },

  qtyControl:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn:       { width: 30, height: 30, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyNum:       { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, minWidth: 36, textAlign: 'center' },

  // Modal
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  handle:       { width: 36, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  sheetTitle:   { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: 4 },
  sheetSub:     { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing.xl },
  inputLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input:        { backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.xl, textAlign: 'center' },
  sheetBtns:    { flexDirection: 'row', gap: Spacing.md },
  cancelBtn:    { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelText:   { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },
  saveBtn:      { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveText:     { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
