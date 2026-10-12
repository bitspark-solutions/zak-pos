'use client';

// Hand-rolled horizontal bar chart — pure SVG, no external chart library.
// Bars are scaled against the maximum row value and rendered inside a
// viewBox so the svg scales to its container width (width="100%").

export interface BarChartRow {
  label: string;
  value: number;
}

export interface BarChartProps {
  rows: BarChartRow[];
  /** Formats the value printed at the end of each bar. Defaults to String(). */
  formatter?: (value: number) => string;
  ariaLabel?: string;
}

// viewBox coordinate space (the svg scales this to 100% of its container).
export const CHART_VIEW_WIDTH = 640;
export const LABEL_COLUMN_WIDTH = 160;
export const VALUE_COLUMN_WIDTH = 120;
export const ROW_HEIGHT = 28;
export const BAR_HEIGHT = 16;
export const BAR_TRACK_WIDTH = CHART_VIEW_WIDTH - LABEL_COLUMN_WIDTH - VALUE_COLUMN_WIDTH;

const BAR_COLOR = '#006a4e';

const MAX_LABEL_CHARS = 20;

function truncateLabel(label: string): string {
  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}

function barWidthFor(value: number, maxValue: number): number {
  if (maxValue <= 0) return 0;
  const clamped = Math.max(0, value);
  return (clamped / maxValue) * BAR_TRACK_WIDTH;
}

export function BarChart({ rows, formatter = (value: number) => String(value), ariaLabel }: BarChartProps) {
  if (rows.length === 0) return null;

  const maxValue = Math.max(...rows.map(row => row.value));
  const height = rows.length * ROW_HEIGHT;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${CHART_VIEW_WIDTH} ${height}`}
      role="img"
      aria-label={ariaLabel ?? 'Report bar chart'}
      style={{ display: 'block' }}
    >
      {rows.map((row, index) => {
        const rowTop = index * ROW_HEIGHT;
        const barTop = rowTop + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        const textBaseline = rowTop + ROW_HEIGHT / 2 + 4;
        return (
          <g key={`${row.label}-${index}`}>
            <text x={0} y={textBaseline} fontSize={11} fill="#374151">
              {truncateLabel(row.label)}
            </text>
            <rect
              x={LABEL_COLUMN_WIDTH}
              y={barTop}
              width={barWidthFor(row.value, maxValue)}
              height={BAR_HEIGHT}
              fill={BAR_COLOR}
            />
            <text
              x={CHART_VIEW_WIDTH - VALUE_COLUMN_WIDTH}
              y={textBaseline}
              fontSize={11}
              fill="#111827"
            >
              {formatter(row.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
