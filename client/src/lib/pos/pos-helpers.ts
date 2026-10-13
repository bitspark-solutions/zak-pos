// Pure POS math, shared by the POS page and unit-tested in pos-helpers.spec.ts.
// Server discount semantics (server/src/cart/cart.service.ts): the `discount`
// on a cart line is an ABSOLUTE amount, lineTotal = unitPrice*qty - discount.
// The UI offers percent presets, so conversion lives here — same formulas the
// mobile app uses (mobile-app/lib/pos/pos-helpers.ts), rewritten for web.

import type { CartLine } from '@/types/pos';

/** Per-line discount dropdown presets, in PERCENT. */
export const DISCOUNT_PRESETS_PERCENT = [0, 5, 10, 15] as const;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Convert a preset PERCENT discount into the absolute discount amount the
 * server's AddLineDto/UpdateLineDto `discount` field expects. Capped at the
 * gross line amount so the amount never goes below zero.
 */
export function discountAmountForPercent(unitPrice: number, qty: number, percent: number): number {
  const gross = unitPrice * qty;
  const amount = (gross * percent) / 100;
  return round2(Math.min(Math.max(amount, 0), gross));
}

/**
 * Reverse lookup: which preset percent (0/5/10/15) does the stored absolute
 * discount match for this line? Returns -1 when no preset matches (custom
 * amount, e.g. after a qty change re-priced the line server-side).
 */
export function presetPercentForDiscount(
  unitPrice: number,
  qty: number,
  discount: number,
  presets: readonly number[] = DISCOUNT_PRESETS_PERCENT,
): number {
  for (const percent of presets) {
    if (discountAmountForPercent(unitPrice, qty, percent) === round2(discount)) {
      return percent;
    }
  }
  return -1;
}

/** Sum of quantities across cart lines (for the header line count). */
export function cartItemCount(lines: Pick<CartLine, 'qty'>[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

/** Cash change = tendered - total, clamped at 0 for invalid inputs. */
export function computeChange(total: number, tendered: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(tendered)) return 0;
  return round2(Math.max(tendered - total, 0));
}

/** Money display for BDT (two decimals, no thousands separators needed at counter scale). */
export function formatMoney(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : round2(value).toFixed(2);
}

/**
 * Barcode-scan cooldown: true when this code should be processed now.
 * A counter camera sees the same physical barcode many frames per second;
 * repeats of the SAME code inside the cooldown window are ignored, while a
 * different code is always accepted (rescan of item A after item B must
 * still increment A again once the window passes).
 */
export function shouldProcessScan(
  code: string,
  lastCode: string | null,
  lastSeenAt: number,
  now: number,
  cooldownMs = 2500,
): boolean {
  if (code === lastCode && now - lastSeenAt < cooldownMs) return false;
  return true;
}
