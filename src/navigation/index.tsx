// src/navigation/index.tsx
// Little Giant POS — Root Navigation

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing } from '../theme';
import { RootTabParamList, CashierStackParamList } from '../types';

// Screens
import MenuScreen from '../screens/cashier/MenuScreen';
import CartScreen from '../screens/cashier/CartScreen';
import PaymentScreen from '../screens/cashier/PaymentScreen';
import OrderSuccessScreen from '../screens/cashier/OrderSuccessScreen';
import DashboardScreen from '../screens/owner/DashboardScreen';
import StocksScreen from '../screens/owner/StocksScreen';
import SettingsScreen from '../screens/owner/SettingsScreen';

import { useStockStore } from '../store';

const Tab = createBottomTabNavigator<RootTabParamList>();
const CashierStack = createStackNavigator<CashierStackParamList>();

function CashierNavigator() {
  return (
    <CashierStack.Navigator screenOptions={{ headerShown: false }}>
      <CashierStack.Screen name="Menu" component={MenuScreen} />
      <CashierStack.Screen name="Cart" component={CartScreen} />
      <CashierStack.Screen name="Payment" component={PaymentScreen} />
      <CashierStack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
    </CashierStack.Navigator>
  );
}

function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function LowStockBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

export default function Navigation() {
  const lowStockItems = useStockStore(s => s.lowStockItems());

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.gray500,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Cashier"
          component={CashierNavigator}
          options={{
            tabBarLabel: 'Order',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="receipt-outline" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Sales',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="bar-chart-outline" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Stocks"
          component={StocksScreen}
          options={{
            tabBarLabel: 'Stocks',
            tabBarIcon: ({ color, size, focused }) => (
              <View>
                <TabIcon name="cube-outline" color={color} size={size} />
                <LowStockBadge count={lowStockItems.length} />
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="settings-outline" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopColor: Colors.border,
    borderTopWidth: 0.5,
    paddingTop: 6,
    paddingBottom: 8,
    height: 64,
  },
  tabLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.danger,
    borderRadius: Spacing.md,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
});
