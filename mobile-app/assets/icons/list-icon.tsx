import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * List/Sales Icon from SVGRepo
 * License: Public Domain (CC0)
 * Source: https://www.svgrepo.com/svg/361339/list
 */
export function ListIcon({ width = 24, height = 24, color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

