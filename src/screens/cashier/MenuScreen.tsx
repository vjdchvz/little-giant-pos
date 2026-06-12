// src/screens/cashier/MenuScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ScrollView, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow, CATEGORY_COLORS } from '../../theme';
import { useCartStore, useMenuStore } from '../../store';
import { menuAPI } from '../../services/localApi';
import { MenuItem } from '../../types';

function MenuCard({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const qtyInCart = useCartStore(s => s.items.find(i => i.menu_item_id === item.id)?.qty ?? 0);
  const unavailable = !item.is_available || (item.servings_left !== undefined && item.servings_left <= 0);
  const catColor = CATEGORY_COLORS[item.category_id ?? 0] ?? Colors.primary;

  return (
    <TouchableOpacity
      style={[styles.card, unavailable && styles.cardUnavailable]}
      onPress={onPress}
      disabled={unavailable}
      activeOpacity={0.75}
    >
      {/* Colored emoji header */}
      <View style={[styles.cardHeader, { backgroundColor: catColor + '22' }]}>
        <Text style={styles.cardEmoji}>{item.emoji}</Text>
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardPrice}>₱{item.price.toFixed(0)}</Text>
      </View>

      {/* Low stock warning */}
      {item.servings_left !== undefined && item.servings_left <= 5 && item.servings_left > 0 && (
        <View style={styles.lowBadge}>
          <Text style={styles.lowBadgeText}>{item.servings_left} left</Text>
        </View>
      )}

      {/* Sold out overlay */}
      {unavailable && (
        <View style={styles.soldOutOverlay}>
          <Text style={styles.soldOutText}>Sold out</Text>
        </View>
      )}

      {/* Cart qty badge */}
      {qtyInCart > 0 && (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>{qtyInCart}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const { items, categories, activeCategory, setItems, setActiveCategory, filteredItems } = useMenuStore();
  const { addItem, itemCount, total } = useCartStore();

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const data = await menuAPI.getAll();
      setItems(data);
    } catch {
      /* keep existing items if any */
    } finally {
      setLoading(false);
    }
  }, [setItems]);

  useEffect(() => { loadMenu(); }, []);

  const count = itemCount();
  const orderTotal = total();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            <Text style={styles.headerBrand}>Little Giant</Text> POS
          </Text>
          <Text style={styles.headerSub}>Tap to add to order</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadMenu}>
          <Ionicons name="refresh-outline" size={20} color={Colors.gray500} />
        </TouchableOpacity>
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catContent}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catPill, activeCategory === cat && styles.catPillActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.catPillText, activeCategory === cat && styles.catPillTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems()}
          keyExtractor={item => String(item.id)}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <MenuCard item={item} onPress={() => addItem(item)} />
          )}
        />
      )}

      {/* Cart FAB */}
      {count > 0 && (
        <TouchableOpacity
          style={styles.cartFab}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.85}
        >
          <View style={styles.cartFabLeft}>
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{count}</Text>
            </View>
            <Text style={styles.cartFabLabel}>View order</Text>
          </View>
          <Text style={styles.cartFabTotal}>₱{orderTotal.toFixed(0)}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: Colors.bgSecondary },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerTitle:       { fontSize: Typography.md, color: Colors.textPrimary },
  headerBrand:       { fontWeight: Typography.bold, color: Colors.primary },
  headerSub:         { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  refreshBtn:        { padding: Spacing.sm },

  catScroll:         { backgroundColor: Colors.white, maxHeight: 52 },
  catContent:        { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm, flexDirection: 'row' },
  catPill:           { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.white },
  catPillActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText:       { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary },
  catPillTextActive: { color: Colors.white },

  loadingWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText:       { fontSize: Typography.sm, color: Colors.textMuted },

  grid:              { padding: Spacing.sm, paddingBottom: 100 },
  gridRow:           { gap: Spacing.sm, marginBottom: Spacing.sm },

  card:              { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border, ...Shadow.sm },
  cardUnavailable:   { opacity: 0.45 },
  cardHeader:        { paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
  cardEmoji:         { fontSize: 34 },
  cardBody:          { padding: Spacing.sm, paddingTop: Spacing.xs, alignItems: 'center', gap: 2 },
  cardName:          { fontSize: 11, fontWeight: Typography.medium, color: Colors.textPrimary, textAlign: 'center', lineHeight: 14 },
  cardPrice:         { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.success },

  lowBadge:          { position: 'absolute', top: 4, left: 4, backgroundColor: Colors.warningLight, borderRadius: Radius.sm, paddingHorizontal: 4, paddingVertical: 1 },
  lowBadgeText:      { fontSize: 9, fontWeight: Typography.bold, color: Colors.warning },
  soldOutOverlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soldOutText:       { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.gray500 },
  qtyBadge:          { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, borderRadius: Radius.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  qtyBadgeText:      { fontSize: 10, fontWeight: Typography.bold, color: Colors.white },

  cartFab:           { position: 'absolute', bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Shadow.md },
  cartFabLeft:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cartCount:         { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: Radius.full, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cartCountText:     { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.white },
  cartFabLabel:      { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.white },
  cartFabTotal:      { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
