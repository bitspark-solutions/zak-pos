import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * Tray/Inventory Icon from SVGRepo
 * License: Public Domain (CC0)
 * Source: https://www.svgrepo.com/svg/361339/tray
 */
export function TrayIcon({ width = 24, height = 24, color = '#000', ...props }: SvgProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M2 7H22M2 7L4 21H20L22 7M2 7V5C2 4.4 2.4 4 3 4H21C21.6 4 22 4.4 22 5V7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

