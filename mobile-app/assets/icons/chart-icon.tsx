import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * Chart/Reports Icon from SVGRepo
 * License: Public Domain (CC0)
 * Source: https://www.svgrepo.com/svg/361339/chart
 */
export function ChartIcon({ width = 24, height = 24, color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M3 3V21H21M7 16L12 11L16 15L21 10M21 10H16M21 10V15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

