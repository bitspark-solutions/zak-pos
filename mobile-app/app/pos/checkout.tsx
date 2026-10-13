/**
 * Checkout screen (G1b): read-only totals, BIG payment-method buttons, and —
 * for Cash only — a big on-screen keypad for the tendered amount (never the
 * system keyboard). Confirm = POST /carts/:token/tender then POST /sales/commit.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useCart } from '@/contexts/CartContext';
import { BigButton } from '@/components/pos/pos-kit';
import {
  KeypadKey,
  computeChange,
  formatMoney,
  parseKeypadAmount,
  pressKeypad,
} from '@/lib/pos/pos-helpers';
import { posHref } from '@/lib/pos/nav';
import type { PaymentMethod } from '@/lib/api/types';
import { POS_COLORS, POS_FONT, POS_SIZES } from '@/constants/pos-theme';

const PAYMENT_OPTIONS: {
  method: PaymentMethod;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { method: 'cash', label: 'Cash', icon: 'cash-outline', color: '#1faa59' },
  { method: 'card', label: 'Card', icon: 'card-outline', color: '#0a7ea4' },
  { method: 'bkash', label: 'bKash', icon: 'phone-portrait-outline', color: '#e2136e' },
  { method: 'nagad', label: 'Nagad', icon: 'phone-portrait-outline', color: '#f7941d' },
  { method: 'bank_transfer', label: 'Bank', icon: 'business-outline', color: '#5c6bc0' },
];

const KEYPAD_ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '00'],
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, checkout } = useCart();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [tenderedDisplay, setTenderedDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = cart?.total ?? 0;
  const itemCount = cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
  const tendered = parseKeypadAmount(tenderedDisplay);
  const change = computeChange(tendered, total);

  const canConfirm = useMemo(() => {
    if (!method || itemCount === 0) return false;
    if (method === 'cash' && tenderedDisplay !== '') return tendered >= total;
    return true; // non-cash and empty-cash submit amountTendered=undefined -> server uses cart.total
  }, [method, itemCount, tenderedDisplay, tendered, total]);

  const pressKey = useCallback((key: KeypadKey) => {
    Haptics.selectionAsync().catch(() => {});
    setTenderedDisplay((prev) => pressKeypad(prev, key));
  }, []);

  const confirm = useCallback(async () => {
    if (!method || !canConfirm || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await checkout(
        method,
        method === 'cash' && tendered > 0 ? tendered : undefined
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(posHref(`/pos/receipt/${result.sale.id}`));
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [method, canConfirm, submitting, checkout, tendered, router]);

  if (!cart || cart.lines.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cart-outline" size={56} color={POS_COLORS.inkMuted} />
        <Text style={styles.emptyText}>The cart is empty. Scan a product first.</Text>
        <BigButton label="Back to scanning" iconName="barcode-outline" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Totals — read only */}
      <View style={styles.totalsCard}>
        <Text style={styles.totalsCaption}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{formatMoney(cart.subtotal)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Discount</Text>
          <Text style={[styles.totalsValue, styles.discountValue]}>-{formatMoney(cart.discount)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>{formatMoney(cart.tax)}</Text>
        </View>
        <View style={[styles.totalsRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Total due</Text>
          <Text style={styles.grandValue}>{formatMoney(cart.total)}</Text>
        </View>
      </View>

      {/* Payment methods — BIG taps */}
      <Text style={styles.sectionTitle}>How is the customer paying?</Text>
      <View style={styles.methodGrid}>
        {PAYMENT_OPTIONS.map((option) => {
          const active = method === option.method;
          return (
            <TouchableOpacity
              key={option.method}
              accessibilityRole="button"
              accessibilityLabel={`Pay with ${option.label}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setMethod(option.method);
                setError(null);
              }}
              style={[
                styles.methodButton,
                { borderColor: option.color },
                active && { backgroundColor: option.color },
              ]}
            >
              <Ionicons
                name={option.icon}
                size={34}
                color={active ? POS_COLORS.surface : option.color}
              />
              <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                {option.label}
              </Text>
              {active ? (
                <Ionicons name="checkmark-circle" size={22} color={POS_COLORS.surface} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Cash keypad */}
      {method === 'cash' ? (
        <View style={styles.cashSection}>
          <Text style={styles.sectionTitle}>Cash received (optional)</Text>
          <View style={styles.amountCard}>
            <Text style={styles.amountInput}>{tenderedDisplay === '' ? '0' : tenderedDisplay}</Text>
            <Text style={styles.amountHint}>
              {tenderedDisplay === ''
                ? 'Leave empty to charge exactly the total'
                : `Change: ${formatMoney(change)}`}
            </Text>
          </View>

          <View style={styles.quickRow}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setTenderedDisplay(total.toFixed(2))}
              style={styles.quickButton}
            >
              <Ionicons name="wallet-outline" size={22} color={POS_COLORS.success} />
              <Text style={[styles.quickLabel, { color: POS_COLORS.success }]}>Exact</Text>
            </TouchableOpacity>
            {[500, 1000].map((note) => (
              <TouchableOpacity
                key={note}
                accessibilityRole="button"
                onPress={() => setTenderedDisplay(String(note))}
                style={styles.quickButton}
              >
                <Ionicons name="cash-outline" size={22} color={POS_COLORS.primary} />
                <Text style={[styles.quickLabel, { color: POS_COLORS.primary }]}>{note}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypad}>
            {KEYPAD_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`Key ${key === 'back' ? 'delete' : key}`}
                    onPress={() => pressKey(key)}
                    style={styles.key}
                  >
                    <Text style={styles.keyLabel}>{key}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                  onPress={() => pressKey('back')}
                  style={[styles.key, styles.keyBack]}
                >
                  <Ionicons name="backspace-outline" size={30} color={POS_COLORS.ink} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {tenderedDisplay !== '' && tendered < total ? (
            <Text style={styles.insufficientHint}>
              Not enough — still {formatMoney(total - tendered)} short.
            </Text>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={24} color={POS_COLORS.errorText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <BigButton
        label={submitting ? 'Saving...' : `Confirm sale · ${formatMoney(total)}`}
        iconName={submitting ? 'hourglass-outline' : 'checkmark-done-circle'}
        color={POS_COLORS.success}
        pressedColor={POS_COLORS.successPressed}
        onPress={confirm}
        disabled={!canConfirm}
        loading={submitting}
        style={styles.confirmButton}
      />
      {submitting ? <ActivityIndicator color={POS_COLORS.primary} style={{ marginTop: 8 }} /> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: POS_COLORS.surfaceAlt },
  content: { padding: 14 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: POS_COLORS.surfaceAlt,
  },
  emptyText: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.inkMuted,
    fontWeight: '700',
    marginBottom: 10,
  },
  totalsCard: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    padding: 16,
    gap: 8,
  },
  totalsCaption: {
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
    fontWeight: '700',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalsLabel: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.inkMuted,
    fontWeight: '600',
  },
  totalsValue: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.ink,
    fontWeight: '700',
  },
  discountValue: {
    color: POS_COLORS.danger,
  },
  grandRow: {
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
    paddingTop: 10,
    marginTop: 2,
  },
  grandLabel: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  grandValue: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.success,
  },
  sectionTitle: {
    fontSize: POS_FONT.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
    marginTop: 18,
    marginBottom: 8,
  },
  methodGrid: {
    gap: 10,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: POS_SIZES.radius,
    backgroundColor: POS_COLORS.surface,
    paddingHorizontal: 16,
    minHeight: POS_SIZES.buttonHeight,
  },
  methodLabel: {
    flex: 1,
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  methodLabelActive: {
    color: POS_COLORS.surface,
  },
  cashSection: { marginTop: 4 },
  amountCard: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  amountHint: {
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: POS_COLORS.line,
    borderRadius: POS_SIZES.radius,
    backgroundColor: POS_COLORS.surface,
    minHeight: POS_SIZES.chipHeight + 8,
  },
  quickLabel: {
    fontSize: POS_FONT.body,
    fontWeight: '800',
  },
  keypad: {
    marginTop: 12,
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  key: {
    flex: 1,
    height: POS_SIZES.keyHeight,
    borderRadius: POS_SIZES.radius,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBack: {
    backgroundColor: POS_COLORS.keyBg,
  },
  keyLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  insufficientHint: {
    marginTop: 10,
    fontSize: POS_FONT.label,
    fontWeight: '700',
    color: POS_COLORS.danger,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: POS_SIZES.radius,
    backgroundColor: POS_COLORS.errorBg,
    borderWidth: 2,
    borderColor: POS_COLORS.errorBorder,
  },
  errorText: {
    flex: 1,
    color: POS_COLORS.errorText,
    fontWeight: '700',
    fontSize: POS_FONT.label,
  },
  confirmButton: { marginTop: 18 },
});
