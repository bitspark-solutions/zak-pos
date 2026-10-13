/**
 * POS flow shell (G1b): shallow stack — Scan -> Checkout -> Receipt.
 * The header always shows the shop name (from GET /shops) plus a live
 * cart-count badge and running total, so the shopkeeper never loses context.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';

import { CartProvider, useCart } from '@/contexts/CartContext';
import { cartItemCount, formatMoney } from '@/lib/pos/pos-helpers';
import { POS_COLORS, POS_FONT } from '@/constants/pos-theme';

function HeaderRight() {
  const { cart } = useCart();
  const count = cart ? cartItemCount(cart.lines) : 0;
  return (
    <View style={styles.headerRight}>
      <View style={styles.badge}>
        <Ionicons name="cart" size={18} color={POS_COLORS.surface} />
        <Text style={styles.badgeText}>{count}</Text>
      </View>
      <Text style={styles.headerTotal}>{formatMoney(cart?.total ?? 0)}</Text>
    </View>
  );
}

function PosStack() {
  const { shop } = useCart();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: POS_COLORS.primary },
        headerTintColor: POS_COLORS.surface,
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerTitle: () => (
          <View style={styles.shopTitle}>
            <Ionicons name="storefront" size={18} color={POS_COLORS.surface} />
            <Text style={styles.shopTitleText} numberOfLines={1}>
              {shop?.name ?? 'Loading shop...'}
            </Text>
          </View>
        ),
        headerRight: () => <HeaderRight />,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Scan to sell' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="receipt/[saleId]" options={{ title: 'Receipt' }} />
      {/* G1c owns this screen; G1b provides the placeholder target */}
      <Stack.Screen name="add-product" options={{ title: 'Add product' }} />
    </Stack>
  );
}

export default function PosLayout() {
  return (
    <CartProvider>
      <PosStack />
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: POS_COLORS.success,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 44,
  },
  badgeText: {
    color: POS_COLORS.surface,
    fontWeight: '800',
    fontSize: POS_FONT.label,
  },
  headerTotal: {
    color: POS_COLORS.surface,
    fontWeight: '800',
    fontSize: POS_FONT.body,
  },
  shopTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 190,
  },
  shopTitleText: {
    color: POS_COLORS.surface,
    fontWeight: '800',
    fontSize: POS_FONT.body,
  },
});
