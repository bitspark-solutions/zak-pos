/**
 * Pure POS math helpers (unit-tested in pos-helpers.spec.ts).
 * No React Native imports — safe for jest (testEnvironment: node).
 *
 * Shared by POS screens (G1b) and the scan-to-add-product flow (G1c).
 */
import type { CartLine } from '@/lib/api/types';

/** Server discount semantics: discount is an ABSOLUTE amount, lineTotal = unitPrice*qty - discount */
export const DISCOUNT_PRESETS_PERCENT = [0, 5, 10, 15] as const;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Convert a preset PERCENT discount into the absolute discount amount the
 * server's AddLineDto/UpdateLineDto `discount` field expects.
 */
export function discountAmountForPercent(
  unitPrice: number,
  qty: number,
  percent: number
): number {
  const amount = (unitPrice * qty * percent) / 100;
  const capped = Math.min(Math.max(amount, 0), unitPrice * qty);
  return round2(capped);
}

/**
 * Reverse lookup: which preset percent (0/5/10/15) does the stored absolute
 * discount amount correspond to for this line? Returns -1 when it matches no
 * preset (custom amount).
 */
export function presetPercentForDiscount(
  unitPrice: number,
  qty: number,
  discount: number,
  presets: readonly number[] = DISCOUNT_PRESETS_PERCENT
): number {
  for (const percent of presets) {
    if (discountAmountForPercent(unitPrice, qty, percent) === round2(discount)) {
      return percent;
    }
  }
  return -1;
}

/** Effective line total after the absolute discount (local fallback math). */
export function lineTotal(unitPrice: number, qty: number, discount: number): number {
  return round2(Math.max(unitPrice * qty - discount, 0));
}

/** Sum of quantities across cart lines (for the header badge). */
export function cartItemCount(lines: Pick<CartLine, 'qty'>[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Find the cart line for a scanned product (server merges by productId+variantId). */
export function findLineForProduct(
  lines: Pick<CartLine, 'id' | 'productId'>[],
  productId: string
): string | null {
  const line = lines.find((l) => l.productId === productId);
  return line ? line.id : null;
}

const CURRENCY_SYMBOL = '\u09F3'; // Bangladeshi Taka sign (BDT is the server's only currency)

/** Format money for display: 1234.5 -> "৳ 1,234.50" (thousands separators, 2 decimals). */
export function formatMoney(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${CURRENCY_SYMBOL} ${sign}${grouped}.${dec}`;
}

/** Change to hand back for cash sales; never negative. */
export function computeChange(amountTendered: number, total: number): number {
  return round2(Math.max(amountTendered - total, 0));
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | 'back' | 'clear';

/**
 * Pure keypad reducer for the cash "amount tendered" field.
 * Returns the new display string; keeps at most 2 decimals and 9 digits.
 */
export function pressKeypad(current: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    return current.includes('.') ? current : current === '' ? '0.' : current + '.';
  }
  const digits = key === '00' ? '00' : key;
  const next = current + digits;
  const [, decimals = ''] = next.split('.');
  if (decimals.length > 2) return current;
  if (next.replace('.', '').replace(/^0+/, '').length > 9) return current;
  // Normalize "0" prefix: "0" + "5" -> "5", but keep "0." paths
  if (current === '0') return digits;
  return next;
}

/** Parse the keypad display string into a number ('' -> 0). */
export function parseKeypadAmount(display: string): number {
  const n = parseFloat(display);
  return Number.isFinite(n) && n >= 0 ? round2(n) : 0;
}
