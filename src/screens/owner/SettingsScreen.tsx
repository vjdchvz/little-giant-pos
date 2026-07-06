// src/screens/owner/SettingsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { menuAPI, ordersAPI, stockAPI } from '../../services/localApi';
import { pushMenuItem } from '../../services/firebaseSync';
import { pullFromCloud } from '../../services/cloudSync';
import { useDashboardStore, useSettingsStore, useMenuStore } from '../../store';
import { MenuItem } from '../../types';
import { useAuthStore } from '../../store';
import { FONT_SCALE_OPTIONS } from '../../theme/fontScale';
import AsyncStorage from '@react-native-async-storage/async-storage';

// One-time cloud menu seed per app session (prevents repeated 147-item pushes)
let seededMenuThisSession = false;

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingRow({ label, value, onPress, icon, last }: {
  label: string; value?: string; onPress?: () => void; icon?: string; last?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.row, !last && styles.rowBorder]} onPress={onPress} disabled={!onPress}>
      {icon && <Ionicons name={icon as any} size={18} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />}
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.gray300} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
interface CategoryOption { id: number; name: string; }

interface ItemModalProps {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onSave: (data: { name: string; price: number; emoji: string; category_id: number | null; stock: number }, id?: number) => Promise<void>;
}

function ItemModal({ visible, item, onClose, onSave }: ItemModalProps) {
  const isEdit = !!item;
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [emoji, setEmoji] = useState('🍽️');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(1);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    menuAPI.getCategories().then((cats: any[]) => setCategories(cats)).catch(() => {});
  }, []);

  useEffect(() => {
    if (visible) {
      setName(item?.name ?? '');
      setPrice(item ? String(item.price) : '');
      setEmoji(item?.emoji ?? '🍽️');
      setStock(item?.servings_left !== undefined ? String(item.servings_left) : '');
      setCategoryId(item?.category_id ?? 1);
    }
  }, [visible, item]);

  const handleSave = async () => {
    if (!name.trim() || !price) return;
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { Alert.alert('Invalid price'); return; }
    const s = parseInt(stock, 10);
    const stockVal = isNaN(s) || s < 0 ? 0 : s;
    Keyboard.dismiss(); // release soft-input before the modal unmounts (Android tap-lock fix)
    setSaving(true);
    try {
      await onSave({ name: name.trim(), price: p, emoji, category_id: categoryId, stock: stockVal }, item?.id);
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{isEdit ? 'Edit Item' : 'Add New Item'}</Text>

          <Text style={styles.inputLabel}>Emoji</Text>
          <TextInput style={styles.input} value={emoji} onChangeText={setEmoji} maxLength={2} />

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Tapsilog" />

          <Text style={styles.inputLabel}>Price (₱)</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" />

          <Text style={styles.inputLabel}>Stock (available qty)</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="0" />

          <Text style={styles.inputLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xl }}>
            <View style={styles.categoryRow}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, categoryId === c.id && styles.catChipActive]}
                  onPress={() => setCategoryId(c.id)}
                >
                  <Text style={[styles.catChipText, categoryId === c.id && styles.catChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { Keyboard.dismiss(); onClose(); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving || !name.trim() || !price}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.saveBtnText}>{isEdit ? 'Save' : 'Add Item'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuListExpanded, setMenuListExpanded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { role, deviceName, logout } = useAuthStore();
  const fontScaleKey = useSettingsStore(s => s.fontScaleKey);
  const setFontScaleKey = useSettingsStore(s => s.setFontScaleKey);

  const handleFontScale = (key: typeof fontScaleKey) => {
    setFontScaleKey(key);
    AsyncStorage.setItem('font_scale_key', key).catch(() => {});
  };

  const [syncing, setSyncing] = useState(false);
  const bumpMenuRefresh = useMenuStore(s => s.triggerRefresh);
  const bumpDashRefresh = useDashboardStore(s => s.triggerRefresh);
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await pullFromCloud();
      await loadMenu();
      bumpMenuRefresh();
      bumpDashRefresh();
      Alert.alert('Synced from Cloud', `Menu: ${res.menu} · Stock: ${res.stock} · Orders: ${res.orders}`);
    } catch {
      Alert.alert('Sync failed', 'Check your internet connection and try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['device_role', 'device_name']);
    logout();
  };

  const triggerDashRefresh = useDashboardStore(s => s.triggerRefresh);
  const handleClearSales = () => {
    Alert.alert(
      'Clear All Sales Data?',
      'This permanently deletes ALL orders and sales history on this device and in the cloud. Stock and menu are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive',
          onPress: async () => {
            try {
              await ordersAPI.clearSalesData();
              triggerDashRefresh();
              Alert.alert('Done', 'All sales data has been cleared.');
            } catch {
              Alert.alert('Error', 'Failed to clear sales data.');
            }
          },
        },
      ],
    );
  };

  // Read-only load (no Firebase push — that caused UI freezes)
  const loadMenu = useCallback(async () => {
    try {
      const data = await menuAPI.getAll();
      setMenuItems(data);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMenu(); }, []);

  // Seed the full menu to the cloud once per app session (repopulates web
  // dashboard if pos_menu was ever cleared). Guarded so it never loops.
  useEffect(() => {
    if (seededMenuThisSession) return;
    seededMenuThisSession = true;
    menuAPI.getAll().then(data => {
      data.forEach(item => pushMenuItem(item.id, {
        is_available: item.is_available, price: item.price,
        name: item.name, emoji: item.emoji,
      }));
    }).catch(() => {});
  }, []);

  const openAdd = () => { setEditingItem(null); setModalVisible(true); };
  const openEdit = (item: MenuItem) => { setEditingItem(item); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setEditingItem(null); };

  const handleSave = async (data: { name: string; price: number; emoji: string; category_id: number | null; stock: number }, id?: number) => {
    if (id) {
      await menuAPI.updateItem(id, {
        name: data.name, price: data.price, emoji: data.emoji,
        category_id: data.category_id ?? undefined,
      });
      // Apply stock change (also updates availability + pushes pos_stock to Firebase)
      await stockAPI.setStock(id, data.stock);
      // Sync name/price/emoji/availability to Firebase menu control
      pushMenuItem(id, { name: data.name, price: data.price, emoji: data.emoji, is_available: data.stock > 0 });
      await loadMenu();
    } else {
      await menuAPI.addItem(data);
      await loadMenu(); // reload to get new id + category name (also pushes menu + stock)
    }
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `I-delete ang "${item.name}"? Hindi na ito lalabas sa menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await menuAPI.deleteItem(item.id);
            setMenuItems(prev => prev.filter(m => m.id !== item.id));
          },
        },
      ]
    );
  };

  const toggleAvailability = async (item: MenuItem) => {
    setTogglingId(item.id);
    try {
      await menuAPI.updateAvailability(item.id, !item.is_available);
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: !m.is_available } : m));
    } catch {
      Alert.alert('Error', 'Failed to update.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Store */}
        <Section title="Store">
          <SettingRow label="Store Name" value="Little Giant Food Stall" icon="storefront-outline" />
          <SettingRow label="Currency" value="PHP (₱)" icon="cash-outline" last />
        </Section>

        {/* Menu Management — owner only */}
        {role === 'owner' && <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.collapseToggle}
              onPress={() => setMenuListExpanded(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={menuListExpanded ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.sectionTitle}>Menu Items ({menuItems.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Ionicons name="add" size={16} color={Colors.white} />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {menuListExpanded && (
            <View style={styles.sectionCard}>
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : menuItems.length === 0 ? (
                <Text style={styles.emptyText}>No menu items yet. Tap "Add Item" to start.</Text>
              ) : (
                <ScrollView style={styles.menuListScroll} nestedScrollEnabled>
                  {menuItems.map((item, i) => (
                    <View key={item.id} style={[styles.menuItemRow, i < menuItems.length - 1 && styles.rowBorder]}>
                      <Text style={styles.menuItemEmoji}>{item.emoji}</Text>
                      <View style={styles.menuItemInfo}>
                        <Text style={styles.menuItemName}>{item.name}</Text>
                        <Text style={styles.menuItemPrice}>₱{item.price.toFixed(2)} · {item.category_name}</Text>
                      </View>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                        <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                      <Switch
                        value={item.is_available}
                        onValueChange={() => toggleAvailability(item)}
                        disabled={togglingId === item.id}
                        trackColor={{ false: Colors.gray300, true: Colors.successLight }}
                        thumbColor={item.is_available ? Colors.success : Colors.gray500}
                      />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>}

        {/* Cloud sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cloud</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleSyncNow}
              disabled={syncing}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-download-outline" size={20} color={Colors.primary} style={{ marginRight: Spacing.md }} />
              <Text style={styles.rowLabel}>Sync Now (pull from cloud)</Text>
              {syncing
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Text Size — global font scale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text Size</Text>
          <View style={styles.sectionCard}>
            <View style={styles.fontRow}>
              {FONT_SCALE_OPTIONS.map(opt => {
                const active = fontScaleKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.fontChip, active && styles.fontChipActive]}
                    onPress={() => handleFontScale(opt.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.fontChipA, active && styles.fontChipTextActive]}>A</Text>
                    <Text style={[styles.fontChipLabel, active && styles.fontChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.fontHint}>Applies to the whole app instantly.</Text>
          </View>
        </View>

        {/* About */}
        <Section title="About">
          <SettingRow label="App Version" value="1.0.9" icon="information-circle-outline" />
          <SettingRow label="Logged in as" value={`${deviceName} (${role ?? '?'})`} icon="person-outline" />
          <SettingRow label="Built by" value="VJ Dechavez" icon="code-slash-outline" last />
        </Section>

        {/* Session */}
        <Section title="Session">
          {role === 'owner' && (
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={handleClearSales}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-bin-outline" size={20} color={Colors.danger} style={{ marginRight: Spacing.md }} />
              <Text style={[styles.rowLabel, { color: Colors.danger, fontWeight: '600' }]}>Clear All Sales Data</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: Colors.dangerLight }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} style={{ marginRight: Spacing.md }} />
            <Text style={[styles.rowLabel, { color: Colors.danger, fontWeight: '600' }]}>Switch Account / Logout</Text>
          </TouchableOpacity>
        </Section>

      </ScrollView>

      <ItemModal
        visible={modalVisible}
        item={editingItem}
        onClose={closeModal}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bgSecondary },
  scroll:           { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  headerBar:        { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  screenTitle:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },

  section:          { marginBottom: Spacing.xl },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  collapseToggle:   { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  menuListScroll:   { maxHeight: 340 },
  sectionTitle:     { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: Spacing.xs },
  sectionCard:      { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },

  addBtn:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  addBtnText:       { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.white },

  row:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 52 },
  rowBorder:        { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  rowLabel:         { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  rowRight:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowValue:         { fontSize: Typography.sm, color: Colors.textMuted },

  loadingRow:       { padding: Spacing.xl, alignItems: 'center' },
  emptyText:        { padding: Spacing.xl, textAlign: 'center', color: Colors.textMuted, fontSize: Typography.sm },

  menuItemRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  menuItemEmoji:    { fontSize: 22, width: 32, textAlign: 'center' },
  menuItemInfo:     { flex: 1 },
  menuItemName:     { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  menuItemPrice:    { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  iconBtn:          { padding: Spacing.sm },

  // Modal
  modalOverlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:       { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  modalHandle:      { width: 36, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle:       { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  inputLabel:       { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input:            { backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary, marginBottom: Spacing.lg },
  categoryRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  catChip:          { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  catChipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText:      { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary },
  catChipTextActive:{ color: Colors.white },
  modalButtons:     { flexDirection: 'row', gap: Spacing.md },
  cancelBtn:        { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText:    { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },
  saveBtn:          { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnText:      { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
  btnDisabled:      { opacity: 0.5 },

  fontRow:          { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  fontChip:         { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white, gap: 2 },
  fontChipActive:   { backgroundColor: Colors.primaryBg, borderColor: Colors.primary },
  fontChipA:        { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textSecondary },
  fontChipLabel:    { fontSize: Typography.xs, color: Colors.textMuted },
  fontChipTextActive:{ color: Colors.primary },
  fontHint:         { fontSize: Typography.xs, color: Colors.textMuted, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
});
