// src/services/printerService.ts — Bluetooth (classic SPP) ESC/POS receipt printing
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BluetoothManager,
  BluetoothEscposPrinter,
  BluetoothDevice,
} from '@vardrz/react-native-bluetooth-escpos-printer';
import { Order } from '../types';

const SAVED_PRINTER_KEY = 'printer_device_address';
const STORE_NAME = 'LITTLE GIANT FOOD STALL';
const LINE_WIDTH = 32; // characters per line on 58mm paper

export type { BluetoothDevice };

// ─── Permissions ────────────────────────────────────────────────────────────
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const sdkInt = Platform.Version as number;
    const perms = sdkInt >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const results = await PermissionsAndroid.requestMultiple(perms);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
}

// ─── Device management ──────────────────────────────────────────────────────
export async function scanForDevices(): Promise<{ paired: BluetoothDevice[]; found: BluetoothDevice[] }> {
  const granted = await requestBluetoothPermissions();
  if (!granted) throw new Error('Bluetooth permission denied.');

  const enabled = await BluetoothManager.isBluetoothEnabled().catch(() => false);
  if (!enabled) await BluetoothManager.enableBluetooth().catch(() => {});

  return BluetoothManager.scanDevices();
}

export async function connectToPrinter(device: BluetoothDevice): Promise<void> {
  await BluetoothManager.connect(device.address);
  await AsyncStorage.setItem(SAVED_PRINTER_KEY, JSON.stringify(device));
}

export async function getSavedPrinter(): Promise<BluetoothDevice | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_PRINTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function forgetPrinter(): Promise<void> {
  await AsyncStorage.removeItem(SAVED_PRINTER_KEY);
}

// Reconnect to the last-paired printer, if any is saved. Returns true if connected.
export async function reconnectSavedPrinter(): Promise<boolean> {
  const saved = await getSavedPrinter();
  if (!saved) return false;
  try {
    const granted = await requestBluetoothPermissions();
    if (!granted) return false;
    await BluetoothManager.connect(saved.address);
    return true;
  } catch {
    return false;
  }
}

// ─── Receipt formatting (58mm / 32-char width) ───────────────────────────────
function padLine(left: string, right: string): string {
  const space = LINE_WIDTH - left.length - right.length;
  if (space <= 0) return `${left.slice(0, LINE_WIDTH - right.length - 1)} ${right}`;
  return left + ' '.repeat(space) + right;
}

function centerLine(text: string): string {
  const pad = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function divider(): string {
  return '-'.repeat(LINE_WIDTH);
}

function peso(n: number): string {
  return `P${n.toFixed(2)}`;
}

// ─── Print a full receipt for an Order ───────────────────────────────────────
export async function printReceipt(order: Order, change?: number): Promise<void> {
  const connected = await BluetoothManager.getConnectedDevice().catch(() => null);
  if (!connected) {
    const reconnected = await reconnectSavedPrinter();
    if (!reconnected) throw new Error('No printer connected. Pair one in Settings → Receipt Printer.');
  }

  const { ALIGN } = BluetoothEscposPrinter;

  await BluetoothEscposPrinter.printText(`${centerLine(STORE_NAME)}\n`, { align: ALIGN.CENTER, widthtimes: 1, heigthtimes: 1 });
  await BluetoothEscposPrinter.printText(`${centerLine('Official Receipt')}\n`, { align: ALIGN.CENTER });
  await BluetoothEscposPrinter.printText(`${divider()}\n`, {});

  await BluetoothEscposPrinter.printText(`${padLine('Order #', order.order_number)}\n`, {});
  await BluetoothEscposPrinter.printText(`${padLine('Cashier', order.cashier_name || 'Cashier')}\n`, {});
  await BluetoothEscposPrinter.printText(`${padLine('Date', new Date(order.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}\n`, {});
  await BluetoothEscposPrinter.printText(`${divider()}\n`, {});

  for (const item of order.items) {
    const name = item.qty > 1 ? `${item.name} x${item.qty}` : item.name;
    await BluetoothEscposPrinter.printText(`${name}\n`, {});
    await BluetoothEscposPrinter.printText(`${padLine('', peso(item.subtotal))}\n`, {});
  }

  await BluetoothEscposPrinter.printText(`${divider()}\n`, {});
  await BluetoothEscposPrinter.printText(`${padLine('Subtotal', peso(order.subtotal))}\n`, {});
  if (order.discount > 0) {
    await BluetoothEscposPrinter.printText(`${padLine('Discount', `-${peso(order.discount)}`)}\n`, {});
  }
  await BluetoothEscposPrinter.printText(`${padLine('TOTAL', peso(order.total))}\n`, { widthtimes: 1, heigthtimes: 1 });
  await BluetoothEscposPrinter.printText(`${padLine('Payment', order.payment_method.toUpperCase())}\n`, {});
  if (order.payment_method === 'cash' && change != null && change >= 0) {
    await BluetoothEscposPrinter.printText(`${padLine('Change', peso(change))}\n`, {});
  }

  await BluetoothEscposPrinter.printText(`${divider()}\n`, {});
  await BluetoothEscposPrinter.printText(`${centerLine('Thank you, salamat po!')}\n\n\n`, { align: ALIGN.CENTER });
  try { await BluetoothEscposPrinter.cutPaper(); } catch { /* printer may not support auto-cut */ }
}

// ─── Test print (used from Settings when pairing) ────────────────────────────
export async function printTestLine(): Promise<void> {
  const connected = await BluetoothManager.getConnectedDevice().catch(() => null);
  if (!connected) throw new Error('Not connected to a printer.');
  const { ALIGN } = BluetoothEscposPrinter;
  await BluetoothEscposPrinter.printText(`${centerLine(STORE_NAME)}\n`, { align: ALIGN.CENTER, widthtimes: 1, heigthtimes: 1 });
  await BluetoothEscposPrinter.printText(`${centerLine('Printer connected!')}\n`, { align: ALIGN.CENTER });
  await BluetoothEscposPrinter.printText(`${centerLine(new Date().toLocaleString('en-PH'))}\n\n\n`, { align: ALIGN.CENTER });
  try { await BluetoothEscposPrinter.cutPaper(); } catch {}
}
