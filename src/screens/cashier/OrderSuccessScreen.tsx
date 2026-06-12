// src/screens/cashier/OrderSuccessScreen.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../theme';

export default function OrderSuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { order, change } = route.params;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue:1, useNativeDriver:true, tension:80, friction:6 }).start();
  }, []);

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
  newOrderBtn:  { backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection:'row', alignItems:'center', gap: Spacing.sm, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md + 2, marginTop: Spacing.md },
  newOrderText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
