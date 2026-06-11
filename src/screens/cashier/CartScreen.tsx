// src/screens/cashier/CartScreen.tsx
// Little Giant POS — Cart / Order Review Screen

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, SafeAreaView, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useCartStore } from '../../store';
import { CartItem } from '../../types';

function CartRow({ item }: { item: CartItem }) {
  const { updateQty, removeItem } = useCartStore();

  return (
    <View style={styles.row}>
      <Text style={styles.rowEmoji}>{item.emoji}</Text>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowPrice}>₱{item.price.toFixed(0)} each</Text>
      </View>
      <View style={styles.qtyCtrl}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.menu_item_id, item.qty - 1)}>
          <Ionicons name="remove" size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.qtyNum}>{item.qty}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.menu_item_id, item.qty + 1)}>
          <Ionicons name="add" size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.rowSubtotal}>₱{item.subtotal.toFixed(0)}</Text>
    </View>
  );
}

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, clearCart, total } = useCartStore();
  const orderTotal = total();

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
        <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => String(i.menu_item_id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <CartRow item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>₱{orderTotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.chargeBtn}
          onPress={() => navigation.navigate('Payment', { total: orderTotal })}
          activeOpacity={0.85}
        >
          <Ionicons name="card-outline" size={20} color={Colors.white} />
          <Text style={styles.chargeBtnText}>Proceed to payment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex:1, backgroundColor: Colors.bgSecondary },
  header:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth:0.5, borderBottomColor: Colors.border },
  backBtn:        { padding: Spacing.xs },
  headerTitle:    { fontSize: Typography.md, fontWeight: Typography.medium, color: Colors.textPrimary },
  clearBtn:       { padding: Spacing.xs },
  clearText:      { fontSize: Typography.sm, color: Colors.danger, fontWeight: Typography.medium },
  list:           { padding: Spacing.lg, paddingBottom: 160 },
  row:            { flexDirection:'row', alignItems:'center', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  rowEmoji:       { fontSize: 28 },
  rowInfo:        { flex:1 },
  rowName:        { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  rowPrice:       { fontSize: Typography.xs, color: Colors.textMuted, marginTop:2 },
  qtyCtrl:        { flexDirection:'row', alignItems:'center', gap: Spacing.sm },
  qtyBtn:         { width:30, height:30, borderRadius: Radius.sm, borderWidth:0.5, borderColor: Colors.border, alignItems:'center', justifyContent:'center' },
  qtyNum:         { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary, minWidth:20, textAlign:'center' },
  rowSubtotal:    { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, minWidth:50, textAlign:'right' },
  separator:      { height: Spacing.sm },
  emptyWrap:      { flex:1, alignItems:'center', justifyContent:'center', gap: Spacing.md, padding: Spacing.xl },
  emptyEmoji:     { fontSize:48 },
  emptyTitle:     { fontSize: Typography.lg, fontWeight: Typography.medium, color: Colors.textPrimary },
  emptySub:       { fontSize: Typography.sm, color: Colors.textMuted, textAlign:'center' },
  backToMenuBtn:  { marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth:0.5, borderColor: Colors.border },
  backToMenuText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  footer:         { position:'absolute', bottom:0, left:0, right:0, backgroundColor: Colors.white, borderTopWidth:0.5, borderTopColor: Colors.border, padding: Spacing.lg, gap: Spacing.md },
  totalRow:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  totalLabel:     { fontSize: Typography.sm, color: Colors.textSecondary },
  totalVal:       { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  chargeBtn:      { backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection:'row', alignItems:'center', justifyContent:'center', gap: Spacing.sm, paddingVertical: Spacing.md + 2 },
  chargeBtnText:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
