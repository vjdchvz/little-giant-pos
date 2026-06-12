// App.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { getDB } from './src/db';
import { Colors, Typography, Spacing, Radius } from './src/theme';
import { stockAPI, StockItem } from './src/services/localApi';

function LowStockAlert({ items, onClose }: { items: StockItem[]; onClose: () => void }) {
  if (items.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>⚠️ Low Stock Alert</Text>
          <Text style={styles.alertSub}>{items.length} item{items.length > 1 ? 's' : ''} are out of stock or running low</Text>
          <FlatList
            data={items.slice(0, 10)}
            keyExtractor={i => String(i.id)}
            style={styles.alertList}
            renderItem={({ item }) => (
              <View style={styles.alertRow}>
                <Text style={styles.alertEmoji}>{item.emoji}</Text>
                <Text style={styles.alertName} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.alertStock, item.stock === 0 && { color: Colors.danger }]}>
                  {item.stock === 0 ? 'OUT' : `${item.stock} left`}
                </Text>
              </View>
            )}
          />
          {items.length > 10 && (
            <Text style={styles.alertMore}>+{items.length - 10} more items</Text>
          )}
          <TouchableOpacity style={styles.alertBtn} onPress={onClose}>
            <Text style={styles.alertBtnText}>Got it — I'll restock</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [showLowStock, setShowLowStock] = useState(false);

  useEffect(() => {
    (async () => {
      await getDB();
      // Check for low/zero stock items on launch
      try {
        const all = await stockAPI.getAll();
        const low = all.filter(i => i.stock <= 5);
        if (low.length > 0) {
          setLowStockItems(low);
          setShowLowStock(true);
        }
      } catch { }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Navigation />
        {showLowStock && (
          <LowStockAlert items={lowStockItems} onClose={() => setShowLowStock(false)} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#1B3060', alignItems: 'center', justifyContent: 'center' },

  alertOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  alertBox:      { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xl, width: '100%', maxHeight: '80%' },
  alertTitle:    { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  alertSub:      { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg },
  alertList:     { maxHeight: 280 },
  alertRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  alertEmoji:    { fontSize: 20, width: 28, textAlign: 'center' },
  alertName:     { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  alertStock:    { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.warning },
  alertMore:     { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  alertBtn:      { marginTop: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  alertBtnText:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
