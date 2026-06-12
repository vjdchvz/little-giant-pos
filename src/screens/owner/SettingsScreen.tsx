// src/screens/owner/SettingsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { menuAPI } from '../../services/localApi';
import { MenuItem } from '../../types';

// ─── Section wrapper ─────────────────────────────────────────────────────────
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
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      disabled={!onPress}
    >
      {icon && <Ionicons name={icon as any} size={18} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />}
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.gray300} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Menu Item Edit Modal ─────────────────────────────────────────────────────
interface EditItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onSave: (id: number, data: Partial<MenuItem>) => Promise<void>;
}

function EditItemModal({ item, onClose, onSave }: EditItemModalProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(String(item?.price ?? ''));
  const [emoji, setEmoji] = useState(item?.emoji ?? '🍽️');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(String(item.price));
      setEmoji(item.emoji);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item || !name.trim() || !price) return;
    setSaving(true);
    try {
      await onSave(item.id, { name: name.trim(), price: parseFloat(price), emoji });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Menu Item</Text>

          <Text style={styles.inputLabel}>Emoji</Text>
          <TextInput style={styles.input} value={emoji} onChangeText={setEmoji} maxLength={2} />

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Item name" />

          <Text style={styles.inputLabel}>Price (₱)</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.saveBtnText}>Save</Text>
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
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadMenu = useCallback(async () => {
    try {
      const data = await menuAPI.getAll();
      setMenuItems(data);
    } catch {
      // keep empty — non-critical for settings UX
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMenu(); }, []);

  const toggleAvailability = async (item: MenuItem) => {
    setTogglingId(item.id);
    try {
      await menuAPI.updateAvailability(item.id, !item.is_available);
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: !m.is_available } : m));
    } catch {
      Alert.alert('Error', 'Failed to update availability.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveItem = async (id: number, data: Partial<MenuItem>) => {
    await menuAPI.updateItem(id, data);
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Store */}
        <Section title="Store">
          <SettingRow label="Store Name" value="Little Giant Food Stall" icon="storefront-outline" onPress={() => {}} />
          <SettingRow label="Currency" value="PHP (₱)" icon="cash-outline" last />
        </Section>

        {/* Menu Management */}
        <Section title="Menu Items">
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : (
            menuItems.map((item, i) => (
              <View key={item.id} style={[styles.menuItemRow, i < menuItems.length - 1 && styles.rowBorder]}>
                <Text style={styles.menuItemEmoji}>{item.emoji}</Text>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemPrice}>₱{item.price.toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => setEditingItem(item)}>
                  <Ionicons name="pencil-outline" size={14} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Switch
                  value={item.is_available}
                  onValueChange={() => toggleAvailability(item)}
                  disabled={togglingId === item.id}
                  trackColor={{ false: Colors.gray300, true: Colors.successLight }}
                  thumbColor={item.is_available ? Colors.success : Colors.gray500}
                />
              </View>
            ))
          )}
        </Section>

        {/* Notifications */}
        <Section title="Alerts">
          <SettingRow label="Low Stock Alerts" icon="notifications-outline" last />
        </Section>

        {/* About */}
        <Section title="About">
          <SettingRow label="App Version" value="0.1.0" icon="information-circle-outline" />
          <SettingRow label="Built by" value="VJ Dechavez" icon="code-slash-outline" last />
        </Section>
      </ScrollView>

      <EditItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  headerBar: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  screenTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  sectionCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 52 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  rowLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowValue: { fontSize: Typography.sm, color: Colors.textMuted },

  loadingRow: { padding: Spacing.xl, alignItems: 'center' },

  menuItemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  menuItemEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontSize: Typography.base, color: Colors.textPrimary },
  menuItemPrice: { fontSize: Typography.xs, color: Colors.textMuted },
  editBtn: { padding: Spacing.sm },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  modalHandle: { width: 36, height: 4, backgroundColor: Colors.gray300, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  inputLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary, marginBottom: Spacing.lg },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textSecondary },
  saveBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.white },
  btnDisabled: { opacity: 0.5 },
});
