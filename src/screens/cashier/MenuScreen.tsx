// src/screens/cashier/MenuScreen.tsx — sidebar layout + landscape/tablet support
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius, Shadow, CATEGORY_COLORS } from '../../theme';
import { useCartStore } from '../../store';
import { menuAPI } from '../../services/localApi';
import { MenuItem } from '../../types';

const CAT_EMOJI: Record<number, string> = {
  1:  '🍢', 2:  '🍳', 3:  '🥔', 4:  '🍟',
  5:  '🍱', 6:  '🍗', 7:  '🔥', 8:  '🍜',
  9:  '🥟', 10: '➕', 11: '🥤', 12: '🍦',
  13: '💧', 14: '🥫', 15: '🧋', 16: '🫧',
  17: '☕', 18: '🧊', 19: '🍹', 20: '🍵',
};

// ─── Menu Card ────────────────────────────────────────────────────────────────
function MenuCard({ item, onPress, isLandscape }: { item: MenuItem; onPress: () => void; isLandscape: boolean }) {
  const qtyInCart = useCartStore(s => s.items.find(i => i.menu_item_id === item.id)?.qty ?? 0);
  const unavailable = !item.is_available || (item.servings_left !== undefined && item.servings_left <= 0);
  const catColor = CATEGORY_COLORS[item.category_id ?? 0] ?? Colors.primary;

  return (
    <TouchableOpacity
      style={[styles.card, unavailable && styles.cardUnavailable, isLandscape && styles.cardLandscape]}
      onPress={onPress}
      disabled={unavailable}
      activeOpacity={0.75}
    >
      <View style={[styles.cardHeader, { backgroundColor: catColor + '22' }, isLandscape && styles.cardHeaderLandscape]}>
        <Text style={[styles.cardEmoji, isLandscape && styles.cardEmojiLandscape]}>{item.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, isLandscape && styles.cardNameLandscape]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.cardPrice, isLandscape && styles.cardPriceLandscape]}>₱{item.price.toFixed(0)}</Text>
      </View>

      {item.servings_left !== undefined && item.servings_left <= 5 && item.servings_left > 0 && (
        <View style={styles.lowBadge}>
          <Text style={styles.lowBadgeText}>{item.servings_left} left</Text>
        </View>
      )}
      {unavailable && (
        <View style={styles.soldOutOverlay}>
          <Text style={styles.soldOutText}>Sold out</Text>
        </View>
      )}
      {qtyInCart > 0 && (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>{qtyInCart}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Category Tab ─────────────────────────────────────────────────────────────
function CategoryTab({ catId, name, active, onPress, isLandscape, cartQty }: {
  catId: number; name: string; active: boolean; onPress: () => void; isLandscape: boolean; cartQty: number;
}) {
  const color = CATEGORY_COLORS[catId] ?? Colors.primary;
  const emoji = CAT_EMOJI[catId] ?? '🍽️';

  return (
    <TouchableOpacity
      style={[
        styles.catTab,
        active && styles.catTabActive,
        active && { borderLeftColor: color },
        isLandscape && styles.catTabLandscape,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.catTabEmojiWrap}>
        <Text style={[styles.catTabEmoji, isLandscape && styles.catTabEmojiLandscape]}>{emoji}</Text>
        {cartQty > 0 && (
          <View style={[styles.catBadge, { backgroundColor: color }]}>
            <Text style={styles.catBadgeText}>{cartQty}</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.catTabName, active && { color, fontWeight: Typography.bold }, isLandscape && styles.catTabNameLandscape]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 600;

  // Columns: portrait phone=2, landscape phone=3, tablet portrait=3, tablet landscape=4
  const numCols = isTablet ? (isLandscape ? 4 : 3) : (isLandscape ? 3 : 2);
  const sidebarW = isLandscape || isTablet ? 100 : 76;

  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [activeCatId, setActiveCatId] = useState<number | null>(null);
  const { addItem, itemCount, total, items: cartItems } = useCartStore();

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const data = await menuAPI.getAll();
      setAllItems(data);
      if (data.length > 0 && activeCatId === null) {
        setActiveCatId(data[0].category_id ?? null);
      }
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMenu(); }, []);

  const categories = React.useMemo(() => {
    const seen = new Set<number>();
    const result: { id: number; name: string }[] = [];
    for (const item of allItems) {
      if (item.category_id && !seen.has(item.category_id)) {
        seen.add(item.category_id);
        result.push({ id: item.category_id, name: item.category_name ?? '' });
      }
    }
    return result;
  }, [allItems]);

  const visibleItems = React.useMemo(
    () => activeCatId ? allItems.filter(i => i.category_id === activeCatId) : allItems,
    [allItems, activeCatId]
  );

  // Cart qty per category
  const cartQtyByCat = React.useMemo(() => {
    const map: Record<number, number> = {};
    for (const cartItem of cartItems) {
      const menuItem = allItems.find(i => i.id === cartItem.menu_item_id);
      if (menuItem?.category_id) {
        map[menuItem.category_id] = (map[menuItem.category_id] ?? 0) + cartItem.qty;
      }
    }
    return map;
  }, [cartItems, allItems]);

  const count = itemCount();
  const orderTotal = total();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <Text style={styles.headerBrand}>Little Giant</Text> POS
        </Text>
        <View style={styles.headerRight}>
          {isLandscape && (
            <Text style={styles.orientationLabel}>Landscape</Text>
          )}
          <TouchableOpacity style={styles.refreshBtn} onPress={loadMenu}>
            <Ionicons name="refresh-outline" size={20} color={Colors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {/* Left sidebar — fixed width wrapper so FlatList can't expand */}
        <View style={{ width: sidebarW, flexShrink: 0, backgroundColor: Colors.white, borderRightWidth: 0.5, borderRightColor: Colors.border }}>
          <FlatList
            data={categories}
            keyExtractor={c => String(c.id)}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: cat }) => (
              <CategoryTab
                catId={cat.id}
                name={cat.name}
                active={activeCatId === cat.id}
                onPress={() => setActiveCatId(cat.id)}
                isLandscape={isLandscape || isTablet}
                cartQty={cartQtyByCat[cat.id] ?? 0}
              />
            )}
          />
        </View>

        {/* Right items */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.itemsPane}
            data={visibleItems}
            keyExtractor={item => String(item.id)}
            numColumns={numCols}
            key={`cols-${numCols}`}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <MenuCard item={item} onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} addItem(item); }} isLandscape={isLandscape || isTablet} />
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No items</Text>}
          />
        )}
      </View>

      {/* Cart FAB */}
      {count > 0 && (
        <TouchableOpacity
          style={[styles.cartFab, isLandscape && styles.cartFabLandscape]}
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
  safe:                   { flex: 1, backgroundColor: Colors.bgSecondary },
  header:                 { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerTitle:            { fontSize: Typography.md, color: Colors.textPrimary },
  headerBrand:            { fontWeight: Typography.bold, color: Colors.primary },
  headerRight:            { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  orientationLabel:       { fontSize: Typography.xs, color: Colors.textMuted, backgroundColor: Colors.bgSecondary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  refreshBtn:             { padding: Spacing.sm },

  body:                   { flex: 1, flexDirection: 'row' },

  // Sidebar
  sidebar:                { backgroundColor: Colors.white, borderRightWidth: 0.5, borderRightColor: Colors.border },
  catTab:                 { paddingVertical: 8, paddingHorizontal: 2, borderLeftWidth: 3, borderLeftColor: 'transparent', alignItems: 'center', gap: 2 },
  catTabActive:           { backgroundColor: Colors.bgSecondary },
  catTabLandscape:        { paddingVertical: 10, paddingHorizontal: 8, flexDirection: 'row', gap: 6, alignItems: 'center' },
  catTabEmojiWrap:        { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  catBadge:               { position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  catBadgeText:           { fontSize: 8, fontWeight: Typography.bold, color: Colors.white },
  catTabEmoji:            { fontSize: 18 },
  catTabEmojiLandscape:   { fontSize: 16 },
  catTabName:             { fontSize: 8, color: Colors.textMuted, textAlign: 'center', lineHeight: 10, width: '100%' },
  catTabNameLandscape:    { fontSize: 10, textAlign: 'left', flex: 1, lineHeight: 13 },

  // Items
  itemsPane:              { flex: 1 },
  loadingWrap:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid:                   { padding: Spacing.sm, paddingBottom: 100 },
  gridRow:                { gap: Spacing.sm, marginBottom: Spacing.sm },
  emptyText:              { textAlign: 'center', color: Colors.textMuted, padding: Spacing.xl },

  // Card
  card:                   { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border, ...Shadow.sm },
  cardLandscape:          { },
  cardUnavailable:        { opacity: 0.45 },
  cardHeader:             { paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  cardHeaderLandscape:    { paddingVertical: Spacing.lg },
  cardEmoji:              { fontSize: 30 },
  cardEmojiLandscape:     { fontSize: 36 },
  cardBody:               { padding: Spacing.sm, paddingTop: 2, alignItems: 'center', gap: 2 },
  cardName:               { fontSize: 10, fontWeight: Typography.medium, color: Colors.textPrimary, textAlign: 'center', lineHeight: 13 },
  cardNameLandscape:      { fontSize: 12, lineHeight: 16 },
  cardPrice:              { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.success },
  cardPriceLandscape:     { fontSize: Typography.base },

  lowBadge:               { position: 'absolute', top: 3, left: 3, backgroundColor: Colors.warningLight, borderRadius: Radius.sm, paddingHorizontal: 4, paddingVertical: 1 },
  lowBadgeText:           { fontSize: 8, fontWeight: Typography.bold, color: Colors.warning },
  soldOutOverlay:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soldOutText:            { fontSize: 10, fontWeight: Typography.bold, color: Colors.gray500 },
  qtyBadge:               { position: 'absolute', top: 3, right: 3, backgroundColor: Colors.primary, borderRadius: Radius.full, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  qtyBadgeText:           { fontSize: 9, fontWeight: Typography.bold, color: Colors.white },

  // Cart FAB
  cartFab:                { position: 'absolute', bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Shadow.md },
  cartFabLandscape:       { bottom: Spacing.md, left: Spacing.xl, right: Spacing.xl },
  cartFabLeft:            { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cartCount:              { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: Radius.full, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cartCountText:          { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.white },
  cartFabLabel:           { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.white },
  cartFabTotal:           { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
