'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { posApi } from '@/lib/api/pos';
import { discountAmountForPercent } from '@/lib/pos/pos-helpers';
import type { Cart, CartLine, PosProductResult, ProductWithDetails } from '@/types/pos';
import type { Shop } from '@/types/admin';

// Mirrors mobile-app/contexts/CartContext.tsx concept (server holds the cart;
// the client only keeps the active token + latest Cart snapshot) but uses the
// web app's state idiom: a plain hook with useState, no external store.

interface UsePosCartResult {
  shop: Shop | null;
  shopLoading: boolean;
  cart: Cart | null;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  /** Resolve a barcode to a product, or null when the code is unknown. */
  lookupBarcode: (code: string) => Promise<ProductWithDetails | null>;
  /** Add a product by id; server MERGES duplicate lines (qty += n). */
  addProduct: (productId: string, opts?: { barcode?: string; qty?: number }) => Promise<CartLine | null>;
  addFromSearch: (product: PosProductResult) => Promise<CartLine | null>;
  incrementLine: (lineId: string) => Promise<void>;
  decrementLine: (lineId: string, currentQty: number) => Promise<void>;
  setLineDiscountPercent: (line: CartLine, percent: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  /** Discard the current cart and start a fresh one (New sale / reset). */
  resetCart: () => Promise<void>;
}

export function usePosCart(): UsePosCartResult {
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shopRef = useRef<Shop | null>(null);
  // Token mirror so ensureCart() never races a stale `cart` closure across
  // rapid scan events.
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    posApi
      .listShops()
      .then(shops => {
        if (cancelled) return;
        const first = shops[0] ?? null;
        shopRef.current = first;
        setShop(first);
        if (!first) {
          setError('No shop is configured for this account yet. Ask the owner to create one in Admin.');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the shop.');
      })
      .finally(() => {
        if (!cancelled) setShopLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Return the active cart token, creating a fresh cart when none exists.
  const ensureCart = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    const activeShop = shopRef.current;
    if (!activeShop) {
      setError('No shop is selected — the POS cannot open a cart.');
      return null;
    }
    const created = await posApi.createCart(activeShop.id);
    tokenRef.current = created.token;
    setCart(created);
    return created.token;
  }, []);

  const applyCart = useCallback((next: Cart) => {
    tokenRef.current = next.token;
    setCart(next);
  }, []);

  const lookupBarcode = useCallback(async (code: string): Promise<ProductWithDetails | null> => {
    return posApi.getProductByBarcode(code);
  }, []);

  const addProduct = useCallback<UsePosCartResult['addProduct']>(
    async (productId, opts) => {
      setBusy(true);
      setError(null);
      try {
        const token = await ensureCart();
        if (!token) return null;
        const updated = await posApi.addLine(token, {
          productId,
          qty: opts?.qty ?? 1,
          ...(opts?.barcode ? { barcode: opts.barcode } : {}),
        });
        applyCart(updated);
        const line = updated.lines.find(l => l.productId === productId) ?? null;
        return line;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not add the product.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [ensureCart, applyCart],
  );

  const addFromSearch = useCallback<UsePosCartResult['addFromSearch']>(
    product => addProduct(product.id),
    [addProduct],
  );

  const mutateLine = useCallback(
    async (lineId: string, patch: { qty?: number; discount?: number }) => {
      const token = tokenRef.current;
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        applyCart(await posApi.updateLine(token, lineId, patch));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update the line.');
      } finally {
        setBusy(false);
      }
    },
    [applyCart],
  );

  const removeLineById = useCallback(
    async (lineId: string) => {
      const token = tokenRef.current;
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        applyCart(await posApi.removeLine(token, lineId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not remove the line.');
      } finally {
        setBusy(false);
      }
    },
    [applyCart],
  );

  const incrementLine = useCallback<UsePosCartResult['incrementLine']>(
    async lineId => {
      const line = cart?.lines.find(l => l.id === lineId);
      if (!line) return;
      await mutateLine(lineId, { qty: line.qty + 1 });
    },
    [cart, mutateLine],
  );

  // Minus at qty 1 removes the line (server also drops qty<=0 on PUT, but an
  // explicit DELETE is the cleaner contract for that case).
  const decrementLine = useCallback<UsePosCartResult['decrementLine']>(
    async (lineId, currentQty) => {
      if (currentQty <= 1) {
        await removeLineById(lineId);
        return;
      }
      await mutateLine(lineId, { qty: currentQty - 1 });
    },
    [removeLineById, mutateLine],
  );

  const removeLine = removeLineById;

  const setLineDiscountPercent = useCallback<UsePosCartResult['setLineDiscountPercent']>(
    async (line, percent) => {
      const discount = discountAmountForPercent(line.unitPrice, line.qty, percent);
      await mutateLine(line.id, { discount });
    },
    [mutateLine],
  );

  const resetCart = useCallback(async () => {
    const token = tokenRef.current;
    // Server has no "new cart for same shop" — cancelling the old cart (best
    // effort) and dropping local state gives the next add a fresh cart.
    if (token) {
      await posApi.cancelCart(token).catch(() => undefined);
    }
    tokenRef.current = null;
    setCart(null);
  }, []);

  return {
    shop,
    shopLoading,
    cart,
    busy,
    error,
    clearError,
    lookupBarcode,
    addProduct,
    addFromSearch,
    incrementLine,
    decrementLine,
    setLineDiscountPercent,
    removeLine,
    resetCart,
  };
}
