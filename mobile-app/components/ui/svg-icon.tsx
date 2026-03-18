import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SvgProps } from 'react-native-svg';

interface SvgIconProps {
  svg: React.ComponentType<SvgProps>;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Generic SVG Icon component that can render any SVG from svgrepo.com
 * Usage: <SvgIcon svg={CartIcon} size={32} color="#007AFF" />
 */
export function SvgIcon({ svg: SvgComponent, size = 24, color = '#000', style }: SvgIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <SvgComponent width={size} height={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

