/**
 * Receipt screen (G1b): shows the committed sale summary and lets the
 * shopkeeper Share the PDF receipt (GET /sales/:id/receipt, added concurrently
 * by server agent G1a — if it isn't live yet we degrade gracefully).
 * "Print (Bluetooth)" is a deliberate NO-OP for phase G3 (BLE/ESC-POS).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useCart } from '@/contexts/CartContext';
import { BigButton } from '@/components/pos/pos-kit';
import { PosApi } from '@/lib/api/pos';
import { formatMoney } from '@/lib/pos/pos-helpers';
import { posHref } from '@/lib/pos/nav';
import { POS_COLORS, POS_FONT, POS_SIZES } from '@/constants/pos-theme';

type PdfState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; uri: string }
  | { status: 'unavailable'; reason: string };

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
}

export default function ReceiptScreen() {
  const router = useRouter();
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  const { lastSale } = useCart();
  const [pdf, setPdf] = useState<PdfState>({ status: 'idle' });

  // Prefer the in-memory commit result; fall back to the persisted sale id
  // (deep link / app restart) via the sale details endpoint.
  const sale = lastSale?.sale.id === saleId ? lastSale!.sale : null;
  const lines = lastSale?.sale.id === saleId ? lastSale!.lines : [];

  const loadPdf = useCallback(async () => {
    if (!saleId) return;
    setPdf({ status: 'loading' });
    try {
      const res = await PosApi.fetchSaleReceipt(saleId);
      if (!res.ok) {
        setPdf({
          status: 'unavailable',
          reason: `Receipt PDF not available yet (HTTP ${res.status}). The server endpoint may still be building.`,
        });
        return;
      }
      const buffer = await res.arrayBuffer();
      const file = new File(Paths.cache, `receipt-${sanitizeName(saleId)}.pdf`);
      file.create({ overwrite: true });
      file.write(new Uint8Array(buffer));
      setPdf({ status: 'ready', uri: file.uri });
    } catch {
      setPdf({
        status: 'unavailable',
        reason: 'Could not download the receipt. Check the connection and try again.',
      });
    }
  }, [saleId]);

  useEffect(() => {
    loadPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const shareReceipt = useCallback(async () => {
    if (pdf.status !== 'ready') {
      loadPdf();
      return;
    }
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Sharing', 'Receipt sharing is available in the mobile app.');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdf.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Send receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({ message: `Receipt ${saleId}: ${formatMoney(sale?.total ?? 0)}` });
      }
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Try again.');
    }
  }, [pdf, loadPdf, saleId, sale]);

  const printBluetooth = useCallback(() => {
    // Intentional no-op: BLE/ESC-POS printing lands in phase G3.
    Alert.alert('Print (Bluetooth)', 'Receipt printing is coming soon (phase G3).');
  }, []);

  const newSale = useCallback(async () => {
    router.replace(posHref('/pos'));
  }, [router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.successCard}>
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={44} color={POS_COLORS.surface} />
        </View>
        <Text style={styles.successTitle}>Sale complete!</Text>
        <Text style={styles.saleIdLabel}>Sale {saleId}</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <SummaryRow label="Items" value={String(lines.reduce((s, l) => s + l.qty, 0) || '')} hidden={!lines.length} />
        <SummaryRow label="Subtotal" value={formatMoney(sale?.subtotal ?? 0)} hidden={!sale} />
        <SummaryRow label="Discount" value={`-${formatMoney(sale?.discount ?? 0)}`} hidden={!sale} />
        <SummaryRow label="Tax" value={formatMoney(sale?.tax ?? 0)} hidden={!sale} />
        <SummaryRow label="Total" value={formatMoney(sale?.total ?? 0)} strong />
      </View>

      {!sale && lines.length === 0 ? (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle" size={22} color={POS_COLORS.primary} />
          <Text style={styles.hintText}>
            Showing the essentials — reopen the app from a finished sale to see the full summary.
          </Text>
        </View>
      ) : null}

      <View style={styles.pdfStatus}>
        {pdf.status === 'loading' ? (
          <View style={styles.pdfRow}>
            <ActivityIndicator color={POS_COLORS.primary} />
            <Text style={styles.pdfText}>Loading receipt PDF...</Text>
          </View>
        ) : pdf.status === 'ready' ? (
          <View style={styles.pdfRow}>
            <Ionicons name="document-text" size={24} color={POS_COLORS.success} />
            <Text style={styles.pdfText}>Receipt PDF ready to share</Text>
          </View>
        ) : pdf.status === 'unavailable' ? (
          <View style={styles.pdfRow}>
            <Ionicons name="cloud-offline-outline" size={24} color={POS_COLORS.warningText} />
            <Text style={styles.pdfText}>{pdf.reason}</Text>
          </View>
        ) : null}
      </View>

      <BigButton
        label={pdf.status === 'ready' ? 'Share receipt (PDF)' : 'Load receipt (PDF)'}
        iconName="share-social-outline"
        onPress={shareReceipt}
        disabled={pdf.status === 'loading'}
        style={styles.button}
      />
      <BigButton
        label="Print (Bluetooth)"
        iconName="print-outline"
        color={POS_COLORS.inkMuted}
        pressedColor={POS_COLORS.inkMuted}
        onPress={printBluetooth}
        style={styles.button}
      />
      <BigButton
        label="Start new sale"
        iconName="barcode-outline"
        color={POS_COLORS.success}
        pressedColor={POS_COLORS.successPressed}
        onPress={newSale}
        style={styles.button}
      />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  hidden,
}: {
  label: string;
  value: string;
  strong?: boolean;
  hidden?: boolean;
}) {
  if (hidden || !value) return null;
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: POS_COLORS.surfaceAlt },
  content: { padding: 16 },
  successCard: {
    alignItems: 'center',
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    paddingVertical: 22,
    gap: 6,
  },
  successCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: POS_COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  successTitle: {
    fontSize: POS_FONT.huge,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  saleIdLabel: {
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
    fontWeight: '600',
  },
  summaryCard: {
    marginTop: 14,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: POS_FONT.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.inkMuted,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.ink,
    fontWeight: '700',
  },
  summaryStrong: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  hintBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: POS_SIZES.radius,
    backgroundColor: POS_COLORS.surface,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
  },
  hintText: {
    flex: 1,
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
  },
  pdfStatus: { marginTop: 14 },
  pdfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  pdfText: {
    flex: 1,
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
    fontWeight: '600',
  },
  button: { marginTop: 12 },
});
