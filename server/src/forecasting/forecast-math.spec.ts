import {
  addIsoDays,
  buildForecastSeries,
  clampHorizonDays,
  classifyRisk,
  computeAvgDailyQty,
  computeDaysOfCover,
  computeDemandWindows,
  computeForecastQty,
  escapeLikePattern,
  formatDateOnly,
  suggestedOrder,
  zeroFilledHistory,
  HORIZON_DEFAULT,
  HORIZON_MAX,
  HORIZON_MIN,
} from './forecast-math';

describe('forecast-math', () => {
  describe('clampHorizonDays', () => {
    it('defaults to 14 when absent or non-finite', () => {
      expect(clampHorizonDays(undefined)).toBe(HORIZON_DEFAULT);
      expect(clampHorizonDays(NaN)).toBe(HORIZON_DEFAULT);
    });

    it('clamps below 3 up to the minimum, never rejecting', () => {
      expect(clampHorizonDays(1)).toBe(HORIZON_MIN);
      expect(clampHorizonDays(0)).toBe(HORIZON_MIN);
      expect(clampHorizonDays(-500)).toBe(HORIZON_MIN);
    });

    it('clamps above 90 down to the maximum', () => {
      expect(clampHorizonDays(91)).toBe(HORIZON_MAX);
      expect(clampHorizonDays(100000)).toBe(HORIZON_MAX);
    });

    it('keeps in-range values, including both bounds', () => {
      expect(clampHorizonDays(HORIZON_MIN)).toBe(HORIZON_MIN);
      expect(clampHorizonDays(14)).toBe(14);
      expect(clampHorizonDays(HORIZON_MAX)).toBe(HORIZON_MAX);
    });
  });

  describe('date helpers', () => {
    it('formats a local Date as YYYY-MM-DD with zero padding', () => {
      expect(formatDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(formatDateOnly(new Date(2026, 9, 12))).toBe('2026-10-12');
    });

    it('shifts ISO days across month and year boundaries', () => {
      expect(addIsoDays('2026-10-12', -1)).toBe('2026-10-11');
      expect(addIsoDays('2026-10-12', -27)).toBe('2026-09-15');
      expect(addIsoDays('2026-01-03', -5)).toBe('2025-12-29');
      expect(addIsoDays('2026-02-27', 3)).toBe('2026-03-02');
      expect(addIsoDays('2024-02-27', 3)).toBe('2024-03-01'); // leap year
    });

    it('splits the 56-day window into two 28-day halves at lastStart', () => {
      const windows = computeDemandWindows('2026-10-12');
      expect(windows.lastStart).toBe('2026-09-15');
      expect(windows.windowStart).toBe('2026-08-18');
      expect(windows.historyStart).toBe('2026-09-15');
    });
  });

  describe('escapeLikePattern', () => {
    it('escapes ILIKE metacharacters so search text matches literally', () => {
      expect(escapeLikePattern('50% _x\\y')).toBe('50\\% \\_x\\\\y');
      expect(escapeLikePattern('plain')).toBe('plain');
    });
  });

  describe('computeAvgDailyQty', () => {
    it('weights the recent half 0.7 and the previous half 0.3', () => {
      // 56 units in the last 28 days = 2/day, no history before that.
      expect(computeAvgDailyQty(56, 0)).toBe(1.4);
      expect(computeAvgDailyQty(0, 56)).toBe(0.6);
      expect(computeAvgDailyQty(28, 28)).toBe(1);
      expect(computeAvgDailyQty(0, 0)).toBe(0);
    });

    it('rounds to 3 decimals', () => {
      // (0.7 + 0.3) / 28 = 0.035714... -> 0.036
      expect(computeAvgDailyQty(1, 1)).toBe(0.036);
    });

    it('handles an empty previous window without drifting', () => {
      // 3 units over 28 days, prev empty: 0.7 * 3/28 = 0.075
      expect(computeAvgDailyQty(3, 0)).toBe(0.075);
    });
  });

  describe('computeForecastQty / computeDaysOfCover', () => {
    it('projects the horizon to 1 decimal', () => {
      expect(computeForecastQty(1.4, 10)).toBe(14);
      expect(computeForecastQty(0.036, 14)).toBe(0.5);
    });

    it('returns null daysOfCover when there is no demand', () => {
      expect(computeDaysOfCover(100, 0)).toBeNull();
    });

    it('divides stock by daily demand to 1 decimal', () => {
      expect(computeDaysOfCover(10, 2)).toBe(5);
      expect(computeDaysOfCover(10, 3)).toBe(3.3);
      expect(computeDaysOfCover(0, 3)).toBe(0);
    });
  });

  describe('classifyRisk', () => {
    it('maps null daysOfCover to ok', () => {
      expect(classifyRisk(null, 500, 0, 14)).toBe('ok');
    });

    it('flags below-horizon cover as out_of_stock, exactly-horizon as low', () => {
      expect(classifyRisk(13.9, 13.9, 1, 14)).toBe('out_of_stock');
      expect(classifyRisk(14, 14, 1, 14)).toBe('low'); // boundary: NOT oos
      expect(classifyRisk(0, 0, 5, 14)).toBe('out_of_stock');
    });

    it('keeps 2*horizonDays out of low and into ok', () => {
      expect(classifyRisk(27.9, 27.9, 1, 14)).toBe('low');
      expect(classifyRisk(28, 28, 1, 14)).toBe('ok'); // boundary: NOT low
    });

    it('only flags overstock strictly above 8*horizonDays with stock and demand', () => {
      expect(classifyRisk(112, 112, 1, 14)).toBe('ok'); // boundary
      expect(classifyRisk(112.1, 112.1, 1, 14)).toBe('overstock');
      expect(classifyRisk(112.1, 0, 1, 14)).toBe('ok'); // zero stock
      expect(classifyRisk(112.1, 112.1, 0, 14)).toBe('ok'); // zero demand
    });
  });

  describe('suggestedOrder', () => {
    it('covers 120% of the forecast minus current stock, ceil to integer', () => {
      expect(suggestedOrder('out_of_stock', 10, 5)).toBe(7); // 12 - 5
      expect(suggestedOrder('low', 8.4, 9)).toBe(2); // 10.08 - 9 = 1.08 -> 2
    });

    it('floors at zero when stock already covers the boosted forecast', () => {
      expect(suggestedOrder('out_of_stock', 10, 13)).toBe(0); // 12 - 13
      expect(suggestedOrder('low', 5, 6)).toBe(0); // exactly 0, stays 0
    });

    it('is always zero for ok and overstock', () => {
      expect(suggestedOrder('ok', 100, 0)).toBe(0);
      expect(suggestedOrder('overstock', 100, 5000)).toBe(0);
    });
  });

  describe('zeroFilledHistory', () => {
    const today = '2026-10-12';

    it('emits 28 consecutive days ending with today, all zero when empty', () => {
      const history = zeroFilledHistory([], today);
      expect(history).toHaveLength(28);
      expect(history[0]).toEqual({ date: '2026-09-15', qtySold: 0 });
      expect(history[27]).toEqual({ date: today, qtySold: 0 });
      const dates = history.map((point) => point.date);
      expect([...dates].sort()).toEqual(dates); // ASC
    });

    it('merges sold quantities into the grid and ignores out-of-window days', () => {
      const history = zeroFilledHistory(
        [
          { date: '2026-10-12', qtySold: 2 },
          { date: '2026-09-15', qtySold: 1.5 },
          { date: '2026-09-14', qtySold: 99 }, // before the window
          { date: '2026-10-13', qtySold: 99 }, // after today
        ],
        today,
      );
      expect(history[0]).toEqual({ date: '2026-09-15', qtySold: 1.5 });
      expect(history[27]).toEqual({ date: '2026-10-12', qtySold: 2 });
      expect(history[10].qtySold).toBe(0);
    });
  });

  describe('buildForecastSeries', () => {
    const today = '2026-10-12';

    it('starts tomorrow, spans horizonDays entries, flat at 2dp', () => {
      const series = buildForecastSeries(0.35, 5, today);
      expect(series).toHaveLength(5);
      expect(series[0]).toEqual({ date: '2026-10-13', expectedQty: 0.35 });
      expect(series[4]).toEqual({ date: '2026-10-17', expectedQty: 0.35 });
    });

    it('rounds the flat rate to 2 decimals', () => {
      const series = buildForecastSeries(0.036, 2, today);
      expect(series[0].expectedQty).toBe(0.04);
    });

    it('spans the maximum horizon', () => {
      const series = buildForecastSeries(1, HORIZON_MAX, today);
      expect(series).toHaveLength(HORIZON_MAX);
      expect(series[89].date).toBe('2027-01-10');
    });
  });
});
