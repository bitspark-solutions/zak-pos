import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * Chevron Right Icon
 * Simple chevron pointing right, commonly used for navigation and expand/collapse
 */
export function ChevronRightIcon({ width = 24, height = 24, color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M9 18L15 12L9 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

