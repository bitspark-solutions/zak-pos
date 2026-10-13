/**
 * Unit tests for the pure POS helpers (npm test -> jest + ts-jest).
 * Covers the barcode->cart-line mapping and the discount math that the
 * preset chips depend on (server stores an ABSOLUTE discount amount,
 * UI works in PERCENT presets).
 */
import {
  cartItemCount,
  computeChange,
  discountAmountForPercent,
  findLineForProduct,
  formatMoney,
  lineTotal,
  parseKeypadAmount,
  pressKeypad,
  presetPercentForDiscount,
} from './pos-helpers';

describe('discount math (percent presets -> absolute server amount)', () => {
  it('converts a preset percent to the absolute discount amount', () => {
    expect(discountAmountForPercent(100, 3, 10)).toBe(30);
    expect(discountAmountForPercent(49.5, 2, 5)).toBe(4.95);
    expect(discountAmountForPercent(10, 1, 0)).toBe(0);
  });

  it('never discounts below zero or above the line value', () => {
    expect(discountAmountForPercent(100, 1, 200)).toBe(100);
    expect(discountAmountForPercent(100, 1, -5)).toBe(0);
  });

  it('rounds to 2 decimals like the server pricing service', () => {
    // 33.33 * 1 * 15% = 4.9995 -> 5
    expect(discountAmountForPercent(33.33, 1, 15)).toBe(5);
  });

  it('reverse-maps a stored discount to its preset percent', () => {
    expect(presetPercentForDiscount(100, 3, 30)).toBe(10);
    expect(presetPercentForDiscount(100, 3, 0)).toBe(0);
    expect(presetPercentForDiscount(100, 3, 15)).toBe(5);
    expect(presetPercentForDiscount(100, 3, 45)).toBe(15);
  });

  it('returns -1 for a custom (non-preset) discount amount', () => {
    expect(presetPercentForDiscount(100, 1, 7)).toBe(-1);
  });

  it('computes line totals the same way as the server', () => {
    expect(lineTotal(120, 2, 30)).toBe(210);
    expect(lineTotal(120, 2, 400)).toBe(0);
  });
});

describe('barcode -> cart line mapping', () => {
  const lines = [
    { id: 'line-a', productId: 'prod-1' },
    { id: 'line-b', productId: 'prod-2' },
  ];

  it('finds the existing line for a scanned product so qty can merge', () => {
    expect(findLineForProduct(lines, 'prod-2')).toBe('line-b');
    expect(findLineForProduct(lines, 'prod-9')).toBeNull();
  });

  it('sums quantities for the header badge', () => {
    expect(cartItemCount([{ qty: 3 }, { qty: 2 }])).toBe(5);
    expect(cartItemCount([])).toBe(0);
  });
});

describe('money formatting and change', () => {
  it('formats BDT with grouping and 2 decimals', () => {
    expect(formatMoney(1234.5)).toBe('\u09F3 1,234.50');
    expect(formatMoney(0)).toBe('\u09F3 0.00');
    expect(formatMoney(-10)).toBe('\u09F3 -10.00');
  });

  it('computes change, never negative', () => {
    expect(computeChange(500, 427.5)).toBe(72.5);
    expect(computeChange(100, 427.5)).toBe(0);
  });
});

describe('cash keypad reducer', () => {
  it('builds amounts and blocks a third decimal', () => {
    expect(pressKeypad('', '5')).toBe('5');
    expect(pressKeypad('5', '.')).toBe('5.');
    expect(pressKeypad('5.', '0')).toBe('5.0');
    expect(pressKeypad('5.0', '5')).toBe('5.05');
    expect(pressKeypad('5.05', '9')).toBe('5.05'); // >2 decimals ignored
  });

  it('normalizes leading zeros and supports 00/back/clear', () => {
    expect(pressKeypad('0', '5')).toBe('5');
    expect(pressKeypad('', '.')).toBe('0.');
    expect(pressKeypad('12', '00')).toBe('1200');
    expect(pressKeypad('1200', 'back')).toBe('120');
    expect(pressKeypad('120', 'clear')).toBe('');
  });

  it('parses the display string safely', () => {
    expect(parseKeypadAmount('500')).toBe(500);
    expect(parseKeypadAmount('')).toBe(0);
    expect(parseKeypadAmount('12.50')).toBe(12.5);
  });
});
