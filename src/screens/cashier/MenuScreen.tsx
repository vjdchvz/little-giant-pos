// src/screens/cashier/MenuScreen.tsx
// Little Giant POS — Cashier Menu Screen

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ScrollView, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useCartStore, useMenuStore } from '../../store';
import { menuAPI } from '../../services/api';
import { MenuItem } from '../../types';

function MenuCard({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const cartItems = useCartStore(s => s.items);
  const qtyInCart = cartItems.find(i => i.menu_item_id === item.id)?.qty || 0;
  const unavailable = !item.is_available || (item.servings_left !== undefined && item.servings_left <= 0);

  return (
    <TouchableOpacity
      style={[styles.card, unavailable && styles.cardUnavailable]}
      onPress={onPress}
      disabled={unavailable}
      activeOpacity={0.75}
    >
      <Text style={styles.cardEmoji}>{item.emoji}</Text>
      <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.cardPrice}>₱{item.price.toFixed(0)}</Text>

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

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);

  const { items, categories, activeCategory, setItems, setActiveCategory, filteredItems } = useMenuStore();
  const { addItem, itemCount, total } = useCartStore();

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const data = await menuAPI.getAll();
      setItems(data);
    } catch (e) {
      // fallback to mock data for development
      setItems(MOCK_MENU);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = useCallback((item: MenuItem) => {
    addItem(item);
  }, [addItem]);

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

      {/* Menu grid */}
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
            <MenuCard item={item} onPress={() => handleAddItem(item)} />
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

// ─── Mock data for dev ───────────────────────
const MOCK_MENU: MenuItem[] = [
  { id:1, name:'Tapsilog',       category_id:1, category_name:'Silog Meals',   price:89,  emoji:'🍳', is_available:true, servings_left:12 },
  { id:2, name:'Longsilog',      category_id:1, category_name:'Silog Meals',   price:79,  emoji:'🌭', is_available:true, servings_left:8  },
  { id:3, name:'Tocilog',        category_id:1, category_name:'Silog Meals',   price:79,  emoji:'🥩', is_available:true, servings_left:6  },
  { id:4, name:'Bangsilog',      category_id:1, category_name:'Silog Meals',   price:95,  emoji:'🐟', is_available:true, servings_left:4  },
  { id:5, name:'Chicken BBQ',    category_id:2, category_name:'BBQ & Grilled', price:75,  emoji:'🍗', is_available:true, servings_left:10 },
  { id:6, name:'Pork BBQ',       category_id:2, category_name:'BBQ & Grilled', price:65,  emoji:'🥓', is_available:true, servings_left:7  },
  { id:7, name:'Isaw',           category_id:2, category_name:'BBQ & Grilled', price:35,  emoji:'🍢', is_available:true, servings_left:20 },
  { id:8, name:'Kwek-kwek',      category_id:3, category_name:'Snacks',        price:25,  emoji:'🟠', is_available:true, servings_left:15 },
  { id:9, name:'Fishball',       category_id:3, category_name:'Snacks',        price:20,  emoji:'⚪', is_available:true, servings_left:18 },
  { id:10,name:"Sago't Gulaman", category_id:4, category_name:'Drinks',        price:25,  emoji:'🧉', is_available:true, servings_left:12 },
  { id:11,name:'Softdrinks',     category_id:4, category_name:'Drinks',        price:30,  emoji:'🥤', is_available:true, servings_left:24 },
  { id:12,name:'Mineral Water',  category_id:4, category_name:'Drinks',        price:20,  emoji:'💧', is_available:true, servings_left:24 },
];

const styles = StyleSheet.create({
  safe:             { flex:1, backgroundColor: Colors.bgSecondary },
  header:           { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth:0.5, borderBottomColor: Colors.border },
  headerTitle:      { fontSize: Typography.md, color: Colors.textPrimary },
  headerBrand:      { fontWeight: Typography.bold, color: Colors.primary },
  headerSub:        { fontSize: Typography.xs, color: Colors.textMuted, marginTop:2 },
  refreshBtn:       { padding: Spacing.sm },
  catScroll:        { backgroundColor: Colors.white, maxHeight: 52 },
  catContent:       { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm, flexDirection:'row' },
  catPill:          { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth:0.5, borderColor: Colors.border, backgroundColor: Colors.white },
  catPillActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText:      { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary },
  catPillTextActive:{ color: Colors.white },
  loadingWrap:      { flex:1, alignItems:'center', justifyContent:'center', gap: Spacing.md },
  loadingText:      { fontSize: Typography.sm, color: Colors.textMuted },
  grid:             { padding: Spacing.md, paddingBottom: 100 },
  gridRow:          { gap: Spacing.sm, marginBottom: Spacing.sm },
  card:             { flex:1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, alignItems:'center', gap: 4, borderWidth:0.5, borderColor: Colors.border, minHeight:110, ...Shadow.sm },
  cardUnavailable:  { opacity:0.45 },
  cardEmoji:        { fontSize: 30 },
  cardName:         { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textPrimary, textAlign:'center', lineHeight:15 },
  cardPrice:        { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.success },
  lowBadge:         { backgroundColor: Colors.warningLight, borderRadius: Radius.sm, paddingHorizontal:5, paddingVertical:1 },
  lowBadgeText:     { fontSize:9, fontWeight: Typography.bold, color: Colors.warning },
  soldOutOverlay:   { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(255,255,255,0.6)', borderRadius: Radius.lg, alignItems:'center', justifyContent:'center' },
  soldOutText:      { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.gray500 },
  qtyBadge:         { position:'absolute', top:-6, right:-6, backgroundColor: Colors.primary, borderRadius: Radius.full, width:20, height:20, alignItems:'center', justifyContent:'center' },
  qtyBadgeText:     { fontSize:10, fontWeight: Typography.bold, color: Colors.white },
  cartFab:          { position:'absolute', bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.lg, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Shadow.md },
  cartFabLeft:      { flexDirection:'row', alignItems:'center', gap: Spacing.sm },
  cartCount:        { backgroundColor:'rgba(255,255,255,0.25)', borderRadius: Radius.full, width:24, height:24, alignItems:'center', justifyContent:'center' },
  cartCountText:    { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.white },
  cartFabLabel:     { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.white },
  cartFabTotal:     { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
});
