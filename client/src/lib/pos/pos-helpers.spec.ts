import {
  cartItemCount,
  computeChange,
  discountAmountForPercent,
  presetPercentForDiscount,
  round2,
  shouldProcessScan,
} from './pos-helpers';

describe('pos-helpers (discount percent <-> absolute amount, scan cooldown)', () => {
  describe('discountAmountForPercent', () => {
    it('converts preset percents to absolute amounts', () => {
      expect(discountAmountForPercent(100, 2, 0)).toBe(0);
      expect(discountAmountForPercent(100, 2, 5)).toBe(10);
      expect(discountAmountForPercent(100, 2, 10)).toBe(20);
      expect(discountAmountForPercent(100, 2, 15)).toBe(30);
    });

    it('rounds to 2 decimals', () => {
      expect(discountAmountForPercent(33.33, 1, 15)).toBe(5); // 4.9995 -> 5.00
      expect(discountAmountForPercent(19.99, 3, 10)).toBe(6); // 5.997 -> 6.00
    });

    it('caps the amount at the gross line value and never goes negative', () => {
      expect(discountAmountForPercent(10, 1, 200)).toBe(10);
      expect(discountAmountForPercent(10, 1, -5)).toBe(0);
    });
  });

  describe('presetPercentForDiscount', () => {
    it('round-trips each preset', () => {
      for (const percent of [0, 5, 10, 15] as const) {
        const amount = discountAmountForPercent(250, 3, percent);
        expect(presetPercentForDiscount(250, 3, amount)).toBe(percent);
      }
    });

    it('returns -1 for a custom (non-preset) amount', () => {
      expect(presetPercentForDiscount(100, 1, 7)).toBe(-1);
    });

    it('0 discount always maps back to the 0% preset', () => {
      expect(presetPercentForDiscount(100, 4, 0)).toBe(0);
    });
  });

  describe('cartItemCount', () => {
    it('sums quantities', () => {
      expect(cartItemCount([{ qty: 2 }, { qty: 3 }])).toBe(5);
      expect(cartItemCount([])).toBe(0);
    });
  });

  describe('computeChange', () => {
    it('subtracts the total from the tendered amount', () => {
      expect(computeChange(485.5, 500)).toBe(14.5);
    });

    it('clamps short payments and invalid inputs to 0', () => {
      expect(computeChange(500, 485.5)).toBe(0);
      expect(computeChange(500, NaN)).toBe(0);
    });
  });

  describe('round2', () => {
    it('rounds banker-safe halves', () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(2.675)).toBe(2.68);
    });
  });

  describe('shouldProcessScan', () => {
    const COOLDOWN = 2500;

    it('ignores the same code within the cooldown window', () => {
      expect(shouldProcessScan('123', '123', 1000, 1000 + COOLDOWN - 1, COOLDOWN)).toBe(false);
    });

    it('accepts the same code once the cooldown has passed (rescan = +1)', () => {
      expect(shouldProcessScan('123', '123', 1000, 1000 + COOLDOWN, COOLDOWN)).toBe(true);
    });

    it('always accepts a different code', () => {
      expect(shouldProcessScan('456', '123', 1000, 1001, COOLDOWN)).toBe(true);
    });

    it('accepts the very first scan (no previous code)', () => {
      expect(shouldProcessScan('123', null, 0, 100, COOLDOWN)).toBe(true);
    });
  });
});
