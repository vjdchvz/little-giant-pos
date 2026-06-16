// src/screens/auth/PINScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../theme';

const PINS = {
  '1234': { role: 'cashier', name: 'Cashier' },
  '9999': { role: 'owner',   name: 'Owner'   },
};

const KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

interface Props { onAuth: (role: string, name: string) => void; }

export default function PINScreen({ onAuth }: Props) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const press = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); setError(''); return; }
    if (key === '')  return;
    const next = pin + key;
    setPin(next);
    setError('');
    if (next.length === 4) verify(next);
  };

  const verify = async (code: string) => {
    const match = PINS[code as keyof typeof PINS];
    if (match) {
      setLoading(true);
      await AsyncStorage.setItem('device_role', match.role);
      await AsyncStorage.setItem('device_name', match.name);
      onAuth(match.role, match.name);
    } else {
      setError('Wrong PIN. Try again.');
      setPin('');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>🏪 Little Giant POS</Text>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.sub}>Cashier: 1234 · Owner: 9999</Text>

        {/* PIN dots */}
        <View style={styles.dots}>
          {[0,1,2,3].map(i => (
            <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Keypad */}
        {KEYS.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                style={[styles.key, key === '' && { opacity: 0 }]}
                onPress={() => press(key)}
                disabled={key === '' || loading}
                activeOpacity={0.7}
              >
                {key === '⌫'
                  ? <Ionicons name="backspace-outline" size={22} color={Colors.textPrimary} />
                  : <Text style={styles.keyText}>{key}</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {loading && <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.primary },
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  brand:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.white, marginBottom: Spacing.xl },
  title:      { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  sub:        { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', marginTop: 4, marginBottom: Spacing.xl },
  dots:       { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.xl },
  dot:        { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent' },
  dotFilled:  { backgroundColor: Colors.white, borderColor: Colors.white },
  error:      { color: '#FFB3B3', fontSize: Typography.sm, marginBottom: Spacing.md },
  row:        { flexDirection: 'row', gap: Spacing.xl, marginBottom: Spacing.md },
  key:        { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  keyText:    { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
});
