// src/screens/cashier/OrderSuccessScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { printReceipt } from '../../services/printerService';

export default function OrderSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { order, change } = route.params;
  const scale = useRef(new Animated.Value(0)).current;
  const [printing, setPrinting] = useState(false);
  const [printFailed, setPrintFailed] = useState(false);

  useEffect(() => {
    Animated.spring(scale, { toValue:1, useNativeDriver:true, tension:80, friction:6 }).start();
  }, []);

  useEffect(() => {
    // Auto-print right after checkout — silent on success, surfaces a retry button on failure
    handlePrint(true);
  }, []);

  const handlePrint = async (silent = false) => {
    setPrinting(true);
    setPrintFailed(false);
    try {
      await printReceipt(order, change);
    } catch (e: any) {
      setPrintFailed(true);
      if (!silent) Alert.alert('Print failed', e?.message ?? 'Could not print the receipt.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Animated.View style={[styles.iconWrap, { transform:[{ scale }] }]}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        </Animated.View>
        <Text style={styles.title}>Order complete!</Text>
        <Text style={styles.orderNum}>{order.order_number}</Text>
        <View style={styles.receipt}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Total paid</Text>
            <Text style={styles.receiptVal}>₱{order.total.toFixed(2)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Method</Text>
            <Text style={styles.receiptVal}>{order.payment_method.toUpperCase()}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Items</Text>
            <Text style={styles.receiptVal}>{order.items.reduce((s:number,i:any)=>s+i.qty,0)}</Text>
          </View>
          {order.payment_method === 'cash' && change != null && change >= 0 && (
            <View style={[styles.receiptRow, styles.changeRow]}>
              <Text style={styles.changeLabel}>Sukli</Text>
              <Text style={styles.changeVal}>₱{Number(change).toFixed(2)}</Text>
            </View>
          )}
        </View>

        {printing && (
          <View style={styles.printStatus}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.printStatusText}>Printing receipt…</Text>
          </View>
        )}
        {!printing && printFailed && (
          <TouchableOpacity style={styles.printRetryBtn} onPress={() => handlePrint(false)} activeOpacity={0.8}>
            <Ionicons name="print-outline" size={16} color={Colors.warning} />
            <Text style={styles.printRetryText}>Print didn't go through — tap to retry</Text>
          </TouchableOpacity>
        )}
        {!printing && !printFailed && (
          <TouchableOpacity style={styles.printAgainBtn} onPress={() => handlePrint(false)} activeOpacity={0.8}>
            <Ionicons name="print-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.printAgainText}>Print receipt again</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.newOrderBtn} onPress={() => navigation.replace('Menu')} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
          <Text style={styles.newOrderText}>New order</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex:1, backgroundColor: Colors.bgSecondary },
  body:         { flex:1, alignItems:'center', justifyContent:'center', padding: Spacing.xl, gap: Spacing.lg },
  iconWrap:     { marginBottom: Spacing.sm },
  title:        { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  orderNum:     { fontSize: Typography.sm, color: Colors.textMuted, marginTop:-Spacing.sm },
  receipt:      { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, width:'100%', gap: Spacing.md, borderWidth:0.5, borderColor: Colors.border },
  receiptRow:   { flexDirection:'row', justifyContent:'space-between' },
  receiptLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  receiptVal:   { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  changeRow:    { borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: Spacing.md, marginTop: Spacing.xs },
  changeLabel:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.success },
  changeVal:    { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.success },
  printStatus:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  printStatusText: { fontSize: Typography.xs, color: Colors.textMuted },
  printRetryBtn:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warningLight, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  printRetryText:  { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.warning },
  printAgainBtn:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  printAgainText:  { fontSize: Typography.xs, color: Colors.textMuted },
  newOrderBtn:  { backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection:'row', alignItems:'center', gap: Spacing.sm, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md + 2, marginTop: Spacing.md },
  newOrderText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
