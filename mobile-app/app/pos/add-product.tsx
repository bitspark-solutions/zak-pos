/**
 * Add product from a scan (G1c): reached from the "Unknown item -> + Add this
 * product" banner on the scan screen (app/pos/index.tsx passes the scanned
 * code as the `barcode` param via lib/pos/nav ADD_PRODUCT_ROUTE).
 *
 * Design bar: big touch targets, ONE required keyboard field (name), tap chips
 * for units/categories, plain decimal inputs for money, no system keyboard for
 * anything optional.
 *
 * Save flow (server-verified, see lib/api/product.ts header for why POST
 * /products cannot carry a barcode):
 *   1. duplicate pre-check      GET /products/barcode/:code
 *   2. POST /product-import/preview   (multipart one-row CSV -> uploadId)
 *   3. POST /product-import/commit    (creates Product + Barcode, auto SKU)
 *   4. PUT /products/:id { isWeighted } when toggled (import can't set it)
 *   5. POST /inventory/adjust type 'IN' for opening stock (creates the row)
 *   6. addProductToCart(product) from CartContext, then router.back() so the
 *      scan screen flashes the new cart line.
 * Category chips are populated from GET /categories (tenant-owned; commit
 * resolves the category by NAME). There is NO tax list endpoint on the server,
 * so the tax picker is intentionally hidden.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BigButton, Chip, PosBannerView } from '@/components/pos/pos-kit';
import { POS_COLORS, POS_FONT, POS_SIZES } from '@/constants/pos-theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, type PosBanner } from '@/contexts/CartContext';
import { ApiError } from '@/lib/api/client';
import { PosApi } from '@/lib/api/pos';
import { ProductApi } from '@/lib/api/product';
import type { Category, ProductWithDetails } from '@/lib/api/types';
import {
  AddProductForm,
  PRODUCT_UNITS,
  buildOpeningStockPayload,
  buildProductImportCsv,
  canCreateProduct,
  isScannableBarcode,
  parseAmountInput,
  validateAddProductForm,
} from '@/lib/pos/product-helpers';

/** Chip list = common units + free-text "Other". */
const UNIT_OPTIONS: { value: string; label: string }[] = [
  ...PRODUCT_UNITS.map((u) => ({ value: u, label: u })),
  { value: 'other', label: 'other' },
];

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return 'Only the shop owner can add new products.';
    return e.message || fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

export default function AddProductScreen() {
  const router = useRouter();
  const { barcode: rawBarcode } = useLocalSearchParams<{ barcode?: string }>();
  const barcode = (rawBarcode ?? '').trim();

  const { user } = useAuth();
  const allowed = canCreateProduct(user ?? null);

  const { shop, addProductToCart } = useCart();

  const [form, setForm] = useState<AddProductForm>({
    barcode,
    name: '',
    basePrice: '',
    defaultCost: '',
    unit: 'pcs',
    otherUnit: '',
    isWeighted: false,
    categoryName: null,
    stockQty: '',
    stockCost: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [banner, setBanner] = useState<PosBanner>(null);
  /** Barcode already belongs to an existing product -> offer to add it instead. */
  const [existing, setExisting] = useState<ProductWithDetails | null>(null);
  /** Product already committed in this session; a retry resumes after creation. */
  const [createdProduct, setCreatedProduct] = useState<ProductWithDetails | null>(null);

  const setField = useCallback(<K extends keyof AddProductForm>(key: K, value: AddProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Tenant categories drive the picker (hidden when empty/unavailable).
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    ProductApi.listCategories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  const validation = useMemo(() => validateAddProductForm(form), [form]);
  const isValid = Object.keys(validation).length === 0;
  const stockRequested = (parseAmountInput(form.stockQty) ?? 0) > 0;

  const goBack = useCallback(() => router.back(), [router]);

  const openExisting = useCallback(async () => {
    if (!existing) return;
    setSubmitting(true);
    try {
      const ok = await addProductToCart(existing, barcode || undefined);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      } else {
        setBanner({ tone: 'error', title: 'Problem', message: 'Could not add the product to the cart.' });
      }
    } finally {
      setSubmitting(false);
    }
  }, [existing, barcode, addProductToCart, router]);

  const save = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitAttempted(true);
    if (stockRequested && !shop) {
      setBanner({ tone: 'error', title: 'No shop yet', message: 'Shop is still loading — opening stock cannot be saved yet.' });
      return;
    }
    setSubmitting(true);
    setBanner(null);
    setExisting(null);
    try {
      let product = createdProduct;

      if (!product) {
        // 1) Duplicate pre-check (scan only lands here when the code was
        //    unknown, but another device may have created it since).
        if (barcode && isScannableBarcode(barcode)) {
          const found = await PosApi.getProductByBarcode(barcode);
          if (found) {
            setExisting(found);
            setBanner({
              tone: 'warning',
              title: 'This barcode already exists',
              message: `${found.name} is already in your catalog. Add it to the cart instead?`,
              barcode,
            });
            return;
          }
        }

        // 2) preview -> commit (the only server path persisting Barcode rows)
        setStage('Uploading...');
        const preview = await ProductApi.uploadProductCsv(buildProductImportCsv(form));
        const candidate = preview.candidates[0];
        if (!candidate) {
          throw new ApiError('The server could not read the product row.', 500);
        }

        setStage('Creating product...');
        const commit = await ProductApi.commitImport(preview.uploadId, [candidate.candidateId]);
        const created = commit.created[0];
        if (!created) {
          const rejected = commit.conflicts[0] ?? commit.skipped[0];
          const reason = rejected?.reason ?? 'The server rejected the product.';
          if (rejected && /already exists/i.test(reason) && barcode) {
            const found = await PosApi.getProductByBarcode(barcode);
            if (found) {
              setExisting(found);
              setBanner({
                tone: 'warning',
                title: 'This barcode already exists',
                message: `${found.name} is already in your catalog. Add it to the cart instead?`,
                barcode,
              });
              return;
            }
          }
          setBanner({ tone: 'error', title: 'Product not created', message: reason });
          return;
        }

        // 3) Full product; PUT the isWeighted flag the CSV cannot carry.
        setStage('Saving options...');
        product = await ProductApi.getProduct(created.id);
        if (form.isWeighted && !product.isWeighted) {
          product = await ProductApi.updateProduct(product.id, { isWeighted: true });
        }
        setCreatedProduct(product);
      }

      // 4) Opening stock: 'IN' creates the inventory row with avgCost=unitCost.
      if (stockRequested) {
        const stock = buildOpeningStockPayload(shop?.id, product.id, form);
        if (stock) {
          setStage('Adding opening stock...');
          try {
            await ProductApi.adjustStock(stock);
          } catch (e) {
            setBanner({
              tone: 'warning',
              title: 'Stock not added',
              message: `Product saved, but opening stock failed: ${errorMessage(e, 'please retry.')}`,
              barcode: barcode || undefined,
            });
            // keep createdProduct so Save retries only the stock step
            return;
          }
        }
      }

      // 5) Into the cart + back to the scanner (its FlashView highlights the line).
      setStage('Adding to cart...');
      const added = await addProductToCart(product, barcode || undefined);
      if (!added) {
        setBanner({
          tone: 'warning',
          title: 'Product created',
          message: 'It is in your catalog, but could not be added to the cart. Scan it again.',
          barcode: barcode || undefined,
        });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      setBanner({ tone: 'error', title: 'Problem', message: errorMessage(e, 'Could not create the product.') });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSubmitting(false);
      setStage(null);
    }
  }, [isValid, submitting, stockRequested, shop, createdProduct, barcode, form, addProductToCart, router]);

  // ------------------------------------------------------------- gates
  if (!allowed) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={56} color={POS_COLORS.primary} />
        <Text style={styles.gateTitle}>Only the shop owner can add new products</Text>
        <Text style={styles.gateBody}>Ask a manager or the owner to scan this item in, then it will sell normally.</Text>
        <BigButton label="Back to scanning" iconName="barcode-outline" onPress={goBack} style={styles.gateButton} />
      </View>
    );
  }

  const showErrors = submitAttempted;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PosBannerView banner={banner} onDismiss={() => setBanner(null)} />

      {existing ? (
        <BigButton
          label={`Add ${existing.name} instead`}
          iconName="cart-outline"
          color={POS_COLORS.success}
          pressedColor={POS_COLORS.successPressed}
          onPress={openExisting}
          loading={submitting}
          style={styles.existingButton}
        />
      ) : null}

      {/* 1. Scanned barcode — read only */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Scanned code</Text>
        {barcode ? (
          <>
            <Text style={styles.codeValue}>{barcode}</Text>
            {!isScannableBarcode(barcode) ? (
              <Text style={styles.codeNote}>
                Letters in the code: it will be saved as the product SKU, not as a scannable barcode.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.codeNote}>No code scanned — this product will not be findable by scanning.</Text>
        )}
      </View>

      {/* 2. Name — the one required keyboard field */}
      <Text style={styles.sectionTitle}>Product name *</Text>
      <TextInput
        value={form.name}
        onChangeText={(t) => setField('name', t)}
        placeholder="e.g. Lady Finger Banana"
        placeholderTextColor={POS_COLORS.inkMuted}
        style={styles.nameInput}
        inputMode="text"
        autoCapitalize="words"
        autoCorrect
      />
      {showErrors && validation.name ? <Text style={styles.errorText}>{validation.name}</Text> : null}

      {/* 3. Money fields */}
      <Text style={styles.sectionTitle}>Selling price (৳) *</Text>
      <TextInput
        value={form.basePrice}
        onChangeText={(t) => setField('basePrice', t)}
        placeholder="0.00"
        placeholderTextColor={POS_COLORS.inkMuted}
        style={styles.numberInput}
        keyboardType="decimal-pad"
      />
      {showErrors && validation.basePrice ? <Text style={styles.errorText}>{validation.basePrice}</Text> : null}

      <Text style={styles.sectionTitle}>Cost price (৳) — optional</Text>
      <TextInput
        value={form.defaultCost}
        onChangeText={(t) => setField('defaultCost', t)}
        placeholder="0.00"
        placeholderTextColor={POS_COLORS.inkMuted}
        style={styles.numberInput}
        keyboardType="decimal-pad"
      />

      {/* 4. Unit — tap chips, no typing */}
      <Text style={styles.sectionTitle}>Unit</Text>
      <View style={styles.chipWrap}>
        {UNIT_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={form.unit === option.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setField('unit', option.value);
            }}
          />
        ))}
      </View>
      {form.unit === 'other' ? (
        <TextInput
          value={form.otherUnit}
          onChangeText={(t) => setField('otherUnit', t)}
          placeholder="Type the unit name"
          placeholderTextColor={POS_COLORS.inkMuted}
          style={styles.textInput}
        />
      ) : null}

      {/* 5. Sold by weight — big toggle row */}
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: form.isWeighted }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setField('isWeighted', !form.isWeighted);
        }}
        style={styles.switchRow}
      >
        <Ionicons
          name={form.isWeighted ? 'scale' : 'scale-outline'}
          size={26}
          color={form.isWeighted ? POS_COLORS.primary : POS_COLORS.inkMuted}
        />
        <View style={styles.switchLabels}>
          <Text style={styles.switchTitle}>Sold by weight</Text>
          <Text style={styles.switchHint}>For loose items priced per kg/ltr</Text>
        </View>
        <Switch
          value={form.isWeighted}
          onValueChange={(v) => setField('isWeighted', v)}
          trackColor={{ false: POS_COLORS.line, true: POS_COLORS.primary }}
          thumbColor={POS_COLORS.surface}
        />
      </TouchableOpacity>

      {/* 6. Opening stock (optional) */}
      <Text style={styles.sectionTitle}>Opening stock qty — optional</Text>
      <TextInput
        value={form.stockQty}
        onChangeText={(t) => setField('stockQty', t)}
        placeholder="0"
        placeholderTextColor={POS_COLORS.inkMuted}
        style={styles.numberInput}
        keyboardType="decimal-pad"
      />
      {stockRequested && !shop ? (
        <Text style={styles.errorText}>Shop is still loading — clearing the stock field saves without it.</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Stock unit cost (৳) — optional</Text>
      <TextInput
        value={form.stockCost}
        onChangeText={(t) => setField('stockCost', t)}
        placeholder={form.defaultCost || 'defaults to cost price'}
        placeholderTextColor={POS_COLORS.inkMuted}
        style={styles.numberInput}
        keyboardType="decimal-pad"
      />

      {/* 7. Category — chips from THIS tenant's GET /categories (tax has no
         list endpoint server-side, so no tax picker is offered). */}
      {categories.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Category — optional</Text>
          <View style={styles.chipWrap}>
            <Chip
              label="none"
              active={form.categoryName === null}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setField('categoryName', null);
              }}
            />
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                active={form.categoryName === category.name}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setField('categoryName', category.name);
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* 8. Actions */}
      <BigButton
        label={stage ?? 'Save product'}
        iconName="checkmark-circle"
        color={POS_COLORS.success}
        pressedColor={POS_COLORS.successPressed}
        onPress={save}
        disabled={!isValid}
        loading={submitting}
        style={styles.saveButton}
      />
      {!isValid && showErrors ? (
        <Text style={styles.errorText}>Name and a valid selling price are required.</Text>
      ) : null}
      {submitting ? <ActivityIndicator color={POS_COLORS.primary} style={styles.spinner} /> : null}

      <BigButton
        label="Cancel"
        iconName="close-outline"
        color={POS_COLORS.inkMuted}
        onPress={goBack}
        disabled={submitting}
        style={styles.cancelButton}
      />
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ------------------------------------------------------------------ styles

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: POS_COLORS.surfaceAlt },
  content: { padding: 14 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: POS_COLORS.surfaceAlt,
  },
  gateTitle: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
    textAlign: 'center',
  },
  gateBody: {
    fontSize: POS_FONT.body,
    color: POS_COLORS.inkMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  gateButton: { alignSelf: 'stretch' },
  existingButton: { marginTop: 10 },
  codeCard: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: {
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
    fontWeight: '700',
  },
  codeValue: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
    letterSpacing: 1,
  },
  codeNote: {
    marginTop: 4,
    fontSize: POS_FONT.tiny,
    color: POS_COLORS.warningText,
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: POS_FONT.label,
    fontWeight: '800',
    color: POS_COLORS.ink,
    marginTop: 16,
    marginBottom: 6,
  },
  nameInput: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    borderWidth: 2,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 14,
    minHeight: POS_SIZES.buttonHeight,
    fontSize: POS_FONT.big,
    fontWeight: '700',
    color: POS_COLORS.ink,
  },
  textInput: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    borderWidth: 2,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 14,
    minHeight: 56,
    marginTop: 8,
    fontSize: POS_FONT.body,
    color: POS_COLORS.ink,
  },
  numberInput: {
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    borderWidth: 2,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 14,
    minHeight: POS_SIZES.buttonHeight,
    fontSize: POS_FONT.huge,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: POS_COLORS.surface,
    borderRadius: POS_SIZES.radius,
    borderWidth: 2,
    borderColor: POS_COLORS.line,
    paddingHorizontal: 14,
    minHeight: POS_SIZES.buttonHeight,
    marginTop: 16,
  },
  switchLabels: { flex: 1 },
  switchTitle: {
    fontSize: POS_FONT.body,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  switchHint: {
    fontSize: POS_FONT.tiny,
    color: POS_COLORS.inkMuted,
  },
  errorText: {
    marginTop: 6,
    fontSize: POS_FONT.label,
    fontWeight: '700',
    color: POS_COLORS.errorText,
  },
  saveButton: { marginTop: 22 },
  spinner: { marginTop: 8 },
  cancelButton: { marginTop: 12 },
  bottomSpacer: { height: 32 },
});
