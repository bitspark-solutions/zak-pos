import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  BarChart,
  BAR_TRACK_WIDTH,
  type BarChartRow,
} from './BarChart';
import { formatBdt } from '@/types/reports';

const ROWS: BarChartRow[] = [
  { label: 'Dairy', value: 200 },
  { label: 'Beverages', value: 100 },
  { label: 'Snacks', value: 50 },
];

function rects(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll('rect'));
}

describe('BarChart', () => {
  it('renders one bar per row with widths scaled to the max value', () => {
    const { container } = render(<BarChart rows={ROWS} formatter={formatBdt} />);
    const bars = rects(container);

    expect(bars).toHaveLength(3);
    expect(Number(bars[0].getAttribute('width'))).toBeCloseTo(BAR_TRACK_WIDTH);
    expect(Number(bars[1].getAttribute('width'))).toBeCloseTo(BAR_TRACK_WIDTH / 2);
    expect(Number(bars[2].getAttribute('width'))).toBeCloseTo(BAR_TRACK_WIDTH / 4);
  });

  it('renders labels and formatted values as svg text', () => {
    render(<BarChart rows={ROWS} formatter={formatBdt} />);

    expect(screen.getByText('Dairy')).toBeInTheDocument();
    expect(screen.getByText('Beverages')).toBeInTheDocument();
    expect(screen.getByText('Snacks')).toBeInTheDocument();
    expect(screen.getByText('BDT 200.00')).toBeInTheDocument();
    expect(screen.getByText('BDT 100.00')).toBeInTheDocument();
    expect(screen.getByText('BDT 50.00')).toBeInTheDocument();
  });

  it('renders a width-100% viewBox svg for responsive scaling', () => {
    const { container } = render(<BarChart rows={ROWS} />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('100%');
    expect(svg?.getAttribute('viewBox')).not.toBeNull();
    expect(svg).toHaveAttribute('role', 'img');
  });

  it('uses the default String formatter when none is provided', () => {
    render(<BarChart rows={[{ label: 'A', value: 7 }]} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders nothing for empty rows', () => {
    const { container } = render(<BarChart rows={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('clamps negative values to zero-width bars but still labels them', () => {
    const { container } = render(
      <BarChart rows={[{ label: 'Up', value: 100 }, { label: 'Down', value: -25 }]} formatter={formatBdt} />,
    );
    const bars = rects(container);

    expect(Number(bars[1].getAttribute('width'))).toBe(0);
    expect(screen.getByText('BDT -25.00')).toBeInTheDocument();
  });
});
