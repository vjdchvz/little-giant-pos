// src/screens/cashier/CartScreen.tsx — notes + quick qty edit + haptics
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useCartStore } from '../../store';
import { CartItem } from '../../types';

function QtyModal({ item, onClose, onSave }: {
  item: CartItem | null; onClose: () => void; onSave: (qty: number) => void;
}) {
  const [val, setVal] = useState(String(item?.qty ?? 1));
  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.qtyOverlay}>
        <View style={styles.qtyBox}>
          <Text style={styles.qtyBoxTitle}>Quantity — {item?.name}</Text>
          <TextInput
            style={styles.qtyBoxInput}
            value={val}
            onChangeText={setVal}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.qtyBoxBtns}>
            <TouchableOpacity style={styles.qtyBoxCancel} onPress={onClose}>
              <Text style={styles.qtyBoxCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.qtyBoxSave}
              onPress={() => { const n = parseInt(val, 10); if (n > 0) { onSave(n); onClose(); } }}
            >
              <Text style={styles.qtyBoxSaveText}>Set</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CartRow({ item, onEditQty }: { item: CartItem; onEditQty: () => void }) {
  const { updateQty, setNotes } = useCartStore();
  const [showNotes, setShowNotes] = useState(!!item.notes);

  return (
    <View style={styles.row}>
      <Text style={styles.rowEmoji}>{item.emoji}</Text>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowPrice}>₱{item.price.toFixed(0)} each</Text>
        {showNotes ? (
          <TextInput
            style={styles.notesInput}
            placeholder="e.g. walang sibuyas, extra rice..."
            placeholderTextColor={Colors.gray300}
            value={item.notes ?? ''}
            onChangeText={t => setNotes(item.menu_item_id, t)}
            autoFocus={!item.notes}
            onBlur={() => { if (!item.notes) setShowNotes(false); }}
          />
        ) : (
          <TouchableOpacity onPress={() => setShowNotes(true)}>
            <Text style={styles.notesAdd}>+ Add note</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.qtyCtrl}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} updateQty(item.menu_item_id, item.qty - 1); }}>
          <Ionicons name="remove" size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onEditQty}>
          <Text style={styles.qtyNum}>{item.qty}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} updateQty(item.menu_item_id, item.qty + 1); }}>
          <Ionicons name="add" size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.rowSubtotal}>₱{item.subtotal.toFixed(0)}</Text>
    </View>
  );
}

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, clearCart, total, updateQty } = useCartStore();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const orderTotal = total();

  const handleClear = () => Alert.alert('Clear Order', 'Remove all items?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: clearCart },
  ]);

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptySub}>Go back and add items to the order</Text>
          <TouchableOpacity style={styles.backToMenuBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backToMenuText}>Back to menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order ({items.length} {items.length === 1 ? 'item' : 'items'})</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => String(i.menu_item_id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <CartRow item={item} onEditQty={() => setEditingItem(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>₱{orderTotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.chargeBtn}
          onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} navigation.navigate('Payment', { total: orderTotal }); }}
          activeOpacity={0.85}
        >
          <Ionicons name="card-outline" size={20} color={Colors.white} />
          <Text style={styles.chargeBtnText}>Proceed to payment</Text>
        </TouchableOpacity>
      </View>

      <QtyModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={qty => editingItem && updateQty(editingItem.menu_item_id, qty)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.bgSecondary },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn:          { padding: Spacing.xs },
  headerTitle:      { fontSize: Typography.md, fontWeight: Typography.medium, color: Colors.textPrimary },
  clearBtn:         { padding: Spacing.xs },
  clearText:        { fontSize: Typography.sm, color: Colors.danger, fontWeight: Typography.medium },
  list:             { padding: Spacing.lg, paddingBottom: 160 },
  row:              { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  rowEmoji:         { fontSize: 28, marginTop: 2 },
  rowInfo:          { flex: 1 },
  rowName:          { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  rowPrice:         { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  notesInput:       { marginTop: Spacing.sm, fontSize: Typography.xs, color: Colors.textPrimary, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 2 },
  notesAdd:         { marginTop: Spacing.xs, fontSize: Typography.xs, color: Colors.primary },
  qtyCtrl:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  qtyBtn:           { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyNum:           { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary, minWidth: 24, textAlign: 'center', borderBottomWidth: 1.5, borderBottomColor: Colors.primary, paddingHorizontal: 2 },
  rowSubtotal:      { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, minWidth: 48, textAlign: 'right', marginTop: 4 },
  separator:        { height: Spacing.sm },
  emptyWrap:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyEmoji:       { fontSize: 48 },
  emptyTitle:       { fontSize: Typography.lg, fontWeight: Typography.medium, color: Colors.textPrimary },
  emptySub:         { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },
  backToMenuBtn:    { marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border },
  backToMenuText:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  footer:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopWidth: 0.5, borderTopColor: Colors.border, padding: Spacing.lg, gap: Spacing.md },
  totalRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:       { fontSize: Typography.sm, color: Colors.textSecondary },
  totalVal:         { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  chargeBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md + 2 },
  chargeBtnText:    { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
  qtyOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  qtyBox:           { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, width: 240, gap: Spacing.md },
  qtyBoxTitle:      { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary, textAlign: 'center' },
  qtyBoxInput:      { backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  qtyBoxBtns:       { flexDirection: 'row', gap: Spacing.md },
  qtyBoxCancel:     { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  qtyBoxCancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  qtyBoxSave:       { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  qtyBoxSaveText:   { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
