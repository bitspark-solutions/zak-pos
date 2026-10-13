/**
 * POS cart session: shop resolution, lazy cart creation, scan-to-add,
 * qty/discount edits, tender + commit. Server state is the source of truth —
 * every mutation returns the fresh Cart from the server and we store it.
 *
 * Shared by POS screens (G1b); G1c (add-product flow) can reuse
 * `addProductToCart`/`refreshCart`/`shop` without editing the screens.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

import { PosApi } from '@/lib/api/pos';
import { ApiError } from '@/lib/api/client';
import type {
  Cart,
  CartLine,
  CommitSaleResult,
  PaymentMethod,
  ProductWithDetails,
  Shop,
} from '@/lib/api/types';
import {
  cartItemCount,
  discountAmountForPercent,
  presetPercentForDiscount,
} from '@/lib/pos/pos-helpers';

export type PosBanner = {
  tone: 'warning' | 'error';
  title: string;
  message: string;
  /** For "unknown item" banners: the scanned code, for the add-product action */
  barcode?: string;
} | null;

interface CartContextValue {
  // shop
  shop: Shop | null;
  shopError: string | null;

  // cart
  cart: Cart | null;
  cartToken: string | null;
  isSaving: boolean;
  lastAddedLineId: string | null;

  // banner (unknown product / errors) — non-blocking
  banner: PosBanner;
  dismissBanner: () => void;

  // actions
  handleScannedCode: (code: string) => Promise<'added' | 'unknown' | 'error'>;
  addProductToCart: (product: ProductWithDetails, barcode?: string) => Promise<boolean>;
  setLineQty: (lineId: string, qty: number) => Promise<void>;
  setLineDiscountPercent: (lineId: string, percent: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  startNewSale: () => Promise<void>;
  checkout: (
    paymentMethod: PaymentMethod,
    amountTendered?: number
  ) => Promise<CommitSaleResult>;
  lastSale: CommitSaleResult | null;

  // derived
  itemCount: number;
  total: number;
  discountPercentFor: (line: CartLine) => number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<PosBanner>(null);
  const [lastAddedLineId, setLastAddedLineId] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<CommitSaleResult | null>(null);

  const shopPromiseRef = useRef<Promise<Shop | null> | null>(null);
  const cartRef = useRef<Cart | null>(null);
  cartRef.current = cart;

  // ------------------------------------------------------------------ shop
  const ensureShop = useCallback(async (): Promise<Shop | null> => {
    if (shop) return shop;
    if (!shopPromiseRef.current) {
      shopPromiseRef.current = PosApi.listShops()
        .then((shops) => {
          const first = shops[0] ?? null;
          setShop(first);
          if (!first) setShopError('No shop found for this account.');
          return first;
        })
        .catch((e) => {
          setShopError(e instanceof Error ? e.message : 'Could not load the shop.');
          return null;
        })
        .finally(() => {
          shopPromiseRef.current = null;
        });
    }
    return shopPromiseRef.current;
  }, [shop]);

  useEffect(() => {
    ensureShop();
  }, [ensureShop]);

  // ------------------------------------------------------------------ cart
  const ensureCart = useCallback(async (): Promise<Cart | null> => {
    const existing = cartRef.current;
    if (existing && existing.status === 'active') return existing;
    if (existing && existing.status !== 'active') {
      // tendered/completed/cancelled — never reuse; open a fresh one
      cartRef.current = null;
    }
    const resolvedShop = await ensureShop();
    if (!resolvedShop) return null;
    try {
      const created = await PosApi.createCart(resolvedShop.id);
      cartRef.current = created;
      setCart(created);
      return created;
    } catch (e) {
      setBanner({
        tone: 'error',
        title: 'Cannot open a cart',
        message: e instanceof Error ? e.message : 'Please try again.',
      });
      return null;
    }
  }, [ensureShop]);

  const applyUpdatedCart = useCallback(
    (updated: Cart) => {
      // The server drops a line when qty reaches 0 via PUT — mirror locally
      // immediately so a failed refresh can't leave a ghost row.
      cartRef.current = updated;
      setCart(updated);
      setLastAddedLineId((prev) => {
        // keep highlight only if the flashed line still exists
        if (prev && !updated.lines.some((l) => l.id === prev)) return null;
        return prev;
      });
    },
    []
  );

  const handleApiFailure = useCallback((e: unknown, fallback: string) => {
    setBanner({
      tone: 'error',
      title: 'Problem',
      message: e instanceof Error ? e.message : fallback,
    });
  }, []);

  const addProductToCart = useCallback(
    async (product: ProductWithDetails, barcode?: string): Promise<boolean> => {
      const activeCart = await ensureCart();
      if (!activeCart) return false;
      setIsSaving(true);
      try {
        // Server MERGES same-product lines (qty += 1), so each scan is qty 1.
        const updated = await PosApi.addLine(activeCart.token, {
          productId: product.id,
          qty: 1,
          barcode,
        });
        applyUpdatedCart(updated);
        // Highlight the line the server holds for this product
        const line = updated.lines.find((l) => l.productId === product.id);
        if (line) setLastAddedLineId(line.id);
        return true;
      } catch (e) {
        handleApiFailure(e, 'Could not add the product.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [ensureCart, applyUpdatedCart, handleApiFailure]
  );

  const handleScannedCode = useCallback(
    async (code: string): Promise<'added' | 'unknown' | 'error'> => {
      try {
        const product = await PosApi.getProductByBarcode(code);
        if (!product) {
          setBanner({
            tone: 'warning',
            title: `Unknown item ${code}`,
            message: 'This barcode is not in your products yet.',
            barcode: code,
          });
          return 'unknown';
        }
        const ok = await addProductToCart(product, code);
        return ok ? 'added' : 'error';
      } catch (e) {
        handleApiFailure(e, `Could not look up ${code}.`);
        return 'error';
      }
    },
    [addProductToCart, handleApiFailure]
  );

  const setLineQty = useCallback(
    async (lineId: string, qty: number) => {
      const active = cartRef.current;
      if (!active) return;
      setIsSaving(true);
      try {
        const updated =
          qty <= 0
            ? await PosApi.removeLine(active.token, lineId)
            : await PosApi.updateLine(active.token, lineId, { qty });
        applyUpdatedCart(updated);
      } catch (e) {
        handleApiFailure(e, 'Could not change the quantity.');
        // resync totals
        try {
          applyUpdatedCart(await PosApi.getCart(active.token));
        } catch {
          // keep optimistic state if resync fails
        }
      } finally {
        setIsSaving(false);
      }
    },
    [applyUpdatedCart, handleApiFailure]
  );

  const setLineDiscountPercent = useCallback(
    async (lineId: string, percent: number) => {
      const active = cartRef.current;
      const line = active?.lines.find((l) => l.id === lineId);
      if (!active || !line) return;
      setIsSaving(true);
      try {
        // Discount presets are PERCENTS on the UI, but the server stores an
        // ABSOLUTE amount (lineTotal = unitPrice*qty - discount).
        const amount = discountAmountForPercent(line.unitPrice, line.qty, percent);
        const updated = await PosApi.updateLine(active.token, lineId, { discount: amount });
        applyUpdatedCart(updated);
      } catch (e) {
        handleApiFailure(e, 'Could not apply the discount.');
      } finally {
        setIsSaving(false);
      }
    },
    [applyUpdatedCart, handleApiFailure]
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      const active = cartRef.current;
      if (!active) return;
      setIsSaving(true);
      try {
        const updated = await PosApi.removeLine(active.token, lineId);
        applyUpdatedCart(updated);
      } catch (e) {
        handleApiFailure(e, 'Could not remove the item.');
      } finally {
        setIsSaving(false);
      }
    },
    [applyUpdatedCart, handleApiFailure]
  );

  const refreshCart = useCallback(async () => {
    const active = cartRef.current;
    if (!active) return;
    try {
      applyUpdatedCart(await PosApi.getCart(active.token));
    } catch (e) {
      // Expired carts (1h Redis TTL) should just start clean, not block the UI.
      if (e instanceof ApiError && e.status === 404) {
        cartRef.current = null;
        setCart(null);
      }
    }
  }, [applyUpdatedCart]);

  const startNewSale = useCallback(async () => {
    const active = cartRef.current;
    if (active && active.status === 'active') {
      await PosApi.deleteCart(active.token);
    }
    cartRef.current = null;
    setCart(null);
    setLastAddedLineId(null);
    setBanner(null);
  }, []);

  /**
   * Checkout: cart must be TENDERED before the server accepts /sales/commit.
   * If a retry happens after a failed commit the cart is already tendered —
   * tolerate that.
   */
  const checkout = useCallback(
    async (paymentMethod: PaymentMethod, amountTendered?: number): Promise<CommitSaleResult> => {
      const active = cartRef.current;
      if (!active) throw new ApiError('Cart is empty', 400);
      setIsSaving(true);
      try {
        try {
          await PosApi.tenderCart(active.token);
        } catch (e) {
          const alreadyTendered =
            e instanceof ApiError &&
            e.status === 400 &&
            /already tendered/i.test(e.message);
          if (!alreadyTendered) throw e;
        }
        const result = await PosApi.commitSale({
          cartToken: active.token,
          paymentMethod,
          amountTendered: amountTendered && amountTendered > 0 ? amountTendered : undefined,
        });
        setLastSale(result);
        cartRef.current = null;
        setCart(null);
        setLastAddedLineId(null);
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const dismissBanner = useCallback(() => setBanner(null), []);

  const discountPercentFor = useCallback(
    (line: CartLine) => presetPercentForDiscount(line.unitPrice, line.qty, line.discount),
    []
  );

  const itemCount = useMemo(() => (cart ? cartItemCount(cart.lines) : 0), [cart]);
  const total = cart?.total ?? 0;

  const value: CartContextValue = {
    shop,
    shopError,
    cart,
    cartToken: cart?.token ?? null,
    isSaving,
    lastAddedLineId,
    banner,
    dismissBanner,
    handleScannedCode,
    addProductToCart,
    setLineQty,
    setLineDiscountPercent,
    removeLine,
    refreshCart,
    startNewSale,
    checkout,
    lastSale,
    itemCount,
    total,
    discountPercentFor,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return ctx;
}
