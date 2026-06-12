// src/screens/cashier/PaymentScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useCartStore, useDashboardStore } from '../../store';
import { ordersAPI } from '../../services/localApi';
import { PaymentMethod } from '../../types';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'cash',  label: 'Cash',  icon: 'cash-outline',             color: Colors.success, bg: Colors.successLight },
  { id: 'gcash', label: 'GCash', icon: 'phone-portrait-outline',   color: '#007DFE',      bg: '#E6F0FF' },
  { id: 'maya',  label: 'Maya',  icon: 'wallet-outline',           color: '#00C389',      bg: '#E0F9F2' },
];

// Quick cash amount buttons
const QUICK_AMOUNTS = [20, 50, 100, 200, 500, 1000];

export default function PaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { total } = route.params;

  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(false);
  const { items, clearCart } = useCartStore();
  const { addOrder } = useDashboardStore();

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;
  const hasEnoughCash = payMethod !== 'cash' || cashAmount >= total;

  const handleCharge = async () => {
    if (!hasEnoughCash) {
      Alert.alert('Kulang ang bayad', `Kulang pa ng ₱${(total - cashAmount).toFixed(2)}`);
      return;
    }
    try {
      setLoading(true);
      const order = await ordersAPI.create({ items, payment_method: payMethod });
      addOrder(order);
      clearCart();
      navigation.replace('OrderSuccess', { order, change: payMethod === 'cash' ? change : 0 });
    } catch {
      const mockOrder = {
        id: Date.now(),
        order_number: `LG-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`,
        status: 'completed' as const,
        payment_method: payMethod,
        subtotal: total, discount: 0, total,
        items: items.map((i, idx) => ({ id: idx, order_id: 0, menu_item_id: i.menu_item_id, name: i.name, price: i.price, qty: i.qty, subtotal: i.subtotal })),
        created_at: new Date().toISOString(),
      };
      addOrder(mockOrder);
      clearCart();
      navigation.replace('OrderSuccess', { order: mockOrder, change: payMethod === 'cash' ? change : 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Total */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total amount due</Text>
          <Text style={styles.amount}>₱{total.toFixed(2)}</Text>
        </View>

        {/* Payment method */}
        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
        <View style={styles.methods}>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodBtn, payMethod === m.id && { borderColor: m.color, borderWidth: 2 }]}
              onPress={() => { setPayMethod(m.id); setCashReceived(''); }}
              activeOpacity={0.8}
            >
              <View style={[styles.methodIcon, { backgroundColor: m.bg }]}>
                <Ionicons name={m.icon as any} size={22} color={m.color} />
              </View>
              <Text style={[styles.methodLabel, payMethod === m.id && { color: m.color }]}>{m.label}</Text>
              {payMethod === m.id && (
                <Ionicons name="checkmark-circle" size={18} color={m.color} style={styles.methodCheck} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Cash input — only shown for cash */}
        {payMethod === 'cash' && (
          <View style={styles.cashSection}>
            <Text style={styles.sectionLabel}>CASH RECEIVED</Text>

            <View style={styles.cashInputRow}>
              <Text style={styles.pesoSign}>₱</Text>
              <TextInput
                style={styles.cashInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={cashReceived}
                onChangeText={setCashReceived}
                autoFocus={false}
              />
              {cashReceived.length > 0 && (
                <TouchableOpacity onPress={() => setCashReceived('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={20} color={Colors.gray300} />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick amount buttons */}
            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.quickBtn, cashAmount === a && styles.quickBtnActive]}
                  onPress={() => setCashReceived(String(a))}
                >
                  <Text style={[styles.quickBtnText, cashAmount === a && styles.quickBtnTextActive]}>
                    ₱{a}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.quickBtn, cashAmount === Math.ceil(total / 100) * 100 && styles.quickBtnActive]}
                onPress={() => setCashReceived(String(Math.ceil(total / 100) * 100))}
              >
                <Text style={[styles.quickBtnText, cashAmount === Math.ceil(total / 100) * 100 && styles.quickBtnTextActive]}>
                  Exact
                </Text>
              </TouchableOpacity>
            </View>

            {/* Change display */}
            {cashAmount > 0 && (
              <View style={[styles.changeRow, change < 0 ? styles.changeInsufficient : styles.changeSufficient]}>
                <Ionicons
                  name={change < 0 ? 'warning-outline' : 'cash-outline'}
                  size={18}
                  color={change < 0 ? Colors.danger : Colors.success}
                />
                <Text style={[styles.changeLabel, { color: change < 0 ? Colors.danger : Colors.success }]}>
                  {change < 0
                    ? `Kulang pa: ₱${Math.abs(change).toFixed(2)}`
                    : `Sukli: ₱${change.toFixed(2)}`
                  }
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items</Text>
            <Text style={styles.summaryVal}>{items.reduce((s, i) => s + i.qty, 0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>₱{total.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalVal}>₱{total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.chargeBtn, (!hasEnoughCash || loading) && styles.chargeBtnDisabled]}
          onPress={handleCharge}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <>
                <Ionicons name="checkmark-circle-outline" size={22} color={Colors.white} />
                <Text style={styles.chargeBtnText}>
                  Charge ₱{total.toFixed(2)} via {payMethod.toUpperCase()}
                </Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                 { flex: 1, backgroundColor: Colors.bgSecondary },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  backBtn:              { padding: Spacing.xs },
  headerTitle:          { fontSize: Typography.md, fontWeight: Typography.medium, color: Colors.textPrimary },
  body:                 { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxxl },
  amountCard:           { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center' },
  amountLabel:          { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', marginBottom: Spacing.sm },
  amount:               { fontSize: Typography.hero, fontWeight: Typography.bold, color: Colors.white },
  sectionLabel:         { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textMuted, letterSpacing: 0.8 },
  methods:              { flexDirection: 'row', gap: Spacing.md },
  methodBtn:            { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 0.5, borderColor: Colors.border, ...Shadow.sm },
  methodIcon:           { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  methodLabel:          { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  methodCheck:          { position: 'absolute', top: Spacing.sm, right: Spacing.sm },

  cashSection:          { gap: Spacing.md },
  cashInputRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.primary, paddingHorizontal: Spacing.md, ...Shadow.sm },
  pesoSign:             { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.primary, marginRight: Spacing.xs },
  cashInput:            { flex: 1, fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, paddingVertical: Spacing.md },
  clearBtn:             { padding: Spacing.sm },
  quickAmounts:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickBtn:             { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  quickBtnActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quickBtnText:         { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  quickBtnTextActive:   { color: Colors.white },
  changeRow:            { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  changeSufficient:     { backgroundColor: Colors.successLight },
  changeInsufficient:   { backgroundColor: Colors.dangerLight },
  changeLabel:          { fontSize: Typography.md, fontWeight: Typography.bold },

  summary:              { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 0.5, borderColor: Colors.border },
  summaryRow:           { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel:         { fontSize: Typography.sm, color: Colors.textSecondary },
  summaryVal:           { fontSize: Typography.sm, color: Colors.textPrimary },
  summaryTotal:         { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  summaryTotalLabel:    { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  summaryTotalVal:      { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },

  footer:               { padding: Spacing.lg, backgroundColor: Colors.white, borderTopWidth: 0.5, borderTopColor: Colors.border },
  chargeBtn:            { backgroundColor: Colors.success, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md + 2 },
  chargeBtnDisabled:    { opacity: 0.5 },
  chargeBtnText:        { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
