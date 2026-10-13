/**
 * POS Scan screen (G1b): continuous camera barcode scanning fills the top,
 * the live cart sits below. Zero typing: scans add items, big +/- buttons
 * change qty, preset chips set discounts. Unknown codes raise a tappable
 * "Add this product" banner that routes to G1c's flow.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useCart } from '@/contexts/CartContext';
import { BigButton, Chip, FlashView, PosBannerView, QtyStepper } from '@/components/pos/pos-kit';
import { DISCOUNT_PRESETS_PERCENT, formatMoney } from '@/lib/pos/pos-helpers';
import { ADD_PRODUCT_ROUTE, posHrefWithParams } from '@/lib/pos/nav';
import { playScanBeep } from '@/lib/pos/beep';
import { POS_COLORS, POS_FONT, POS_SIZES } from '@/constants/pos-theme';
import type { CartLine } from '@/lib/api/types';

/** Don't re-fire the same code within this window (CameraView emits repeatedly). */
const SCAN_COOLDOWN_MS = 1600;

const BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'itf14',
  'codabar',
  'qr',
];

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const {
    cart,
    banner,
    dismissBanner,
    handleScannedCode,
    setLineQty,
    setLineDiscountPercent,
    removeLine,
    isSaving,
    lastAddedLineId,
    itemCount,
    total,
    discountPercentFor,
    shopError,
  } = useCart();

  const scanningRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [scanning, setScanning] = useState(false);

  const onBarcodeScanned = useCallback(
    async (result: { data: string }) => {
      const now = Date.now();
      if (scanningRef.current) return;
      if (result.data === lastCodeRef.current.code && now - lastCodeRef.current.at < SCAN_COOLDOWN_MS) {
        return;
      }
      scanningRef.current = true;
      setScanning(true);
      lastCodeRef.current = { code: result.data, at: now };
      try {
        const outcome = await handleScannedCode(result.data);
        if (outcome === 'added') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          playScanBeep();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      } finally {
        scanningRef.current = false;
        setScanning(false);
      }
    },
    [handleScannedCode]
  );

  const goToCheckout = useCallback(() => {
    router.push(posHrefWithParams('/pos/checkout', {}));
  }, [router]);

  const goAddProduct = useCallback(
    (code: string) => {
      router.push(posHrefWithParams(ADD_PRODUCT_ROUTE, { barcode: code }));
    },
    [router]
  );

  // ------------------------------------------------------------- render
  let cameraArea: React.ReactNode;
  if (!permission) {
    cameraArea = (
      <View style={styles.permissionCard}>
        <ActivityIndicator size="large" color={POS_COLORS.primary} />
      </View>
    );
  } else if (!permission.granted) {
    cameraArea = (
      <View style={styles.permissionCard}>
        <Ionicons name="barcode-outline" size={72} color={POS_COLORS.primary} />
        <Text style={styles.permissionTitle}>Allow camera to scan products</Text>
        <Text style={styles.permissionBody}>
          Point the camera at a product barcode to add it to the cart — no typing needed.
        </Text>
        <BigButton
          label="Allow camera"
          iconName="camera"
          onPress={() => permission.canAskAgain ? requestPermission() : undefined}
          style={styles.permissionButton}
        />
        {!permission.canAskAgain ? (
          <Text style={styles.permissionHint}>Enable the camera in Settings, then reopen the app.</Text>
        ) : null}
      </View>
    );
  } else {
    cameraArea = (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <View style={styles.scanFrame} pointerEvents="none">
          <Text style={styles.scanHint}>
            {scanning ? 'Reading...' : 'Point at a barcode'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {cameraArea}

      <PosBannerView
        banner={banner}
        onDismiss={dismissBanner}
        action={
          banner?.barcode
            ? { label: '+ Add this product', onPress: () => goAddProduct(banner.barcode!) }
            : undefined
        }
      />

      {shopError ? (
        <View style={styles.shopError}>
          <Ionicons name="alert-circle" size={22} color={POS_COLORS.danger} />
          <Text style={styles.shopErrorText}>{shopError}</Text>
        </View>
      ) : null}

      <View style={styles.cartArea}>
        <View style={styles.cartHeaderRow}>
          <Ionicons name="cart-outline" size={22} color={POS_COLORS.ink} />
          <Text style={styles.cartHeaderTitle}>Cart</Text>
          {isSaving ? <ActivityIndicator size="small" color={POS_COLORS.primary} /> : null}
        </View>

        {cart && cart.lines.length > 0 ? (
          <FlatList
            data={cart.lines}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => (
              <CartLineRow
                line={item}
                flash={lastAddedLineId === item.id}
                activeDiscount={discountPercentFor(item)}
                onIncrement={() => setLineQty(item.id, item.qty + 1)}
                onDecrement={() => setLineQty(item.id, item.qty - 1)}
                onDiscount={(pct) => setLineDiscountPercent(item.id, pct)}
                onRemove={() => removeLine(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyCart}>
            <Ionicons name="barcode" size={44} color={POS_COLORS.inkMuted} />
            <Text style={styles.emptyText}>Scan a product to start the sale</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.bottomTotals}>
          <Text style={styles.bottomCount}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
          <Text style={styles.bottomTotal}>{formatMoney(total)}</Text>
        </View>
        <BigButton
          label="Checkout"
          iconName="checkmark-circle"
          color={POS_COLORS.success}
          pressedColor={POS_COLORS.successPressed}
          onPress={goToCheckout}
          disabled={itemCount === 0}
          style={styles.checkoutButton}
        />
      </View>
    </View>
  );
}

// ------------------------------------------------------------- line row

function CartLineRow({
  line,
  flash,
  activeDiscount,
  onIncrement,
  onDecrement,
  onDiscount,
  onRemove,
}: {
  line: CartLine;
  flash: boolean;
  activeDiscount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onDiscount: (percent: number) => void;
  onRemove: () => void;
}) {
  return (
    <FlashView active={flash} style={styles.lineRow}>
      <View style={styles.lineTopRow}>
        <Text style={styles.lineName} numberOfLines={2}>
          {line.productName}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Remove ${line.productName}`}
          onPress={onRemove}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name="trash-outline" size={26} color={POS_COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.lineMidRow}>
        <Text style={styles.linePrice}>{formatMoney(line.unitPrice)} each</Text>
        <QtyStepper
          qty={line.qty}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
        />
        <Text style={styles.lineTotal}>{formatMoney(line.lineTotal)}</Text>
      </View>

      <View style={styles.discountRow}>
        <Text style={styles.discountLabel}>Offer</Text>
        {DISCOUNT_PRESETS_PERCENT.map((pct) => (
          <Chip
            key={pct}
            label={`${pct}%`}
            active={activeDiscount === pct}
            onPress={() => onDiscount(pct)}
          />
        ))}
      </View>
    </FlashView>
  );
}

// ------------------------------------------------------------- styles

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: POS_COLORS.surfaceAlt,
  },
  cameraWrap: {
    height: 260,
    backgroundColor: POS_COLORS.ink,
  },
  scanFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 14,
  },
  scanHint: {
    color: POS_COLORS.surface,
    backgroundColor: POS_COLORS.scanOverlay,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: POS_FONT.label,
    fontWeight: '700',
  },
  permissionCard: {
    height: 260,
    backgroundColor: POS_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  permissionTitle: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.inkMuted,
    textAlign: 'center',
  },
  permissionButton: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  permissionHint: {
    fontSize: POS_FONT.label,
    color: POS_COLORS.danger,
    textAlign: 'center',
  },
  shopError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: POS_COLORS.errorBg,
    borderRadius: POS_SIZES.radius,
  },
  shopErrorText: {
    flex: 1,
    color: POS_COLORS.errorText,
    fontWeight: '700',
    fontSize: POS_FONT.label,
  },
  cartArea: {
    flex: 1,
    marginTop: 10,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  cartHeaderTitle: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  lineRow: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    padding: 14,
    gap: 8,
  },
  lineTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  lineName: {
    flex: 1,
    fontSize: POS_FONT.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  lineMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linePrice: {
    flex: 1,
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
  },
  lineTotal: {
    flex: 1,
    textAlign: 'right',
    fontSize: POS_FONT.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountLabel: {
    fontSize: POS_FONT.label,
    fontWeight: '700',
    color: POS_COLORS.inkMuted,
    marginRight: 2,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.inkMuted,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: POS_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: POS_COLORS.line,
  },
  bottomTotals: {
    flex: 1,
  },
  bottomCount: {
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
    fontWeight: '700',
  },
  bottomTotal: {
    fontSize: POS_FONT.huge,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  checkoutButton: {
    flex: 1.2,
  },
});
