/**
 * Reusable POS building blocks: icon+label big buttons, discount chips,
 * quantity steppers, banners. Shared by G1b screens and G1c's add-product
 * flow — import from '@/components/pos/pos-kit'.
 */
import React, { useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { POS_COLORS, POS_FONT, POS_SIZES } from '@/constants/pos-theme';
import type { PosBanner } from '@/contexts/CartContext';

// ---------------------------------------------------------------- BigButton

interface BigButtonProps {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  pressedColor?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BigButton({
  label,
  iconName,
  onPress,
  color = POS_COLORS.primary,
  pressedColor,
  disabled,
  loading,
  style,
}: BigButtonProps) {
  const pressed = useRef(new Animated.Value(0)).current;
  const scale = pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.9}
        disabled={disabled || loading}
        onPressIn={() => Animated.spring(pressed, { toValue: 1, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(pressed, { toValue: 0, useNativeDriver: true }).start()}
        onPress={onPress}
        style={[
          styles.bigButton,
          { backgroundColor: pressedColor ?? color },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={POS_COLORS.surface} />
        ) : (
          <Ionicons name={iconName} size={28} color={POS_COLORS.surface} />
        )}
        <Text style={styles.bigButtonLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ------------------------------------------------------------------- Chip

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Discount ${label}`}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// --------------------------------------------------------------- Stepper

interface QtyStepperProps {
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
  flash?: boolean;
}

export function QtyStepper({ qty, onIncrement, onDecrement, flash }: QtyStepperProps) {
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Remove one"
        onPress={onDecrement}
        style={styles.stepButton}
      >
        <Ionicons name="remove" size={28} color={POS_COLORS.ink} />
      </TouchableOpacity>
      <FlashView active={!!flash} style={styles.qtyValue}>
        <Text style={styles.qtyText}>{qty}</Text>
      </FlashView>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Add one"
        onPress={onIncrement}
        style={[styles.stepButton, styles.stepButtonPrimary]}
      >
        <Ionicons name="add" size={28} color={POS_COLORS.surface} />
      </TouchableOpacity>
    </View>
  );
}

// ------------------------------------------------------------ FlashView

/** Fades a background flash whenever `active` toggles true (row feedback). */
export function FlashView({
  active,
  style,
  children,
}: {
  active: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const wasActive = useRef(false);

  useEffect(() => {
    if (active && !wasActive.current) {
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]).start();
    }
    wasActive.current = active;
  }, [active, anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(31,170,89,0)', 'rgba(31,170,89,0.28)'],
  });

  return <Animated.View style={[{ backgroundColor }, style]}>{children}</Animated.View>;
}

// ---------------------------------------------------------------- Banner

interface BannerProps {
  banner: PosBanner;
  onDismiss: () => void;
  action?: { label: string; onPress: () => void };
}

export function PosBannerView({ banner, onDismiss, action }: BannerProps) {
  if (!banner) return null;
  const isError = banner.tone === 'error';
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isError ? POS_COLORS.errorBg : POS_COLORS.warningBg,
          borderColor: isError ? POS_COLORS.errorBorder : POS_COLORS.warningBorder,
        },
      ]}
    >
      <Ionicons
        name={isError ? 'alert-circle' : 'help-circle'}
        size={30}
        color={isError ? POS_COLORS.errorText : POS_COLORS.warningText}
      />
      <View style={styles.bannerBody}>
        <Text
          style={[
            styles.bannerTitle,
            { color: isError ? POS_COLORS.errorText : POS_COLORS.warningText },
          ]}
          numberOfLines={1}
        >
          {banner.title}
        </Text>
        <Text style={styles.bannerMessage} numberOfLines={2}>
          {banner.message}
        </Text>
        {action ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={action.onPress}
            style={[
              styles.bannerAction,
              { borderColor: isError ? POS_COLORS.errorText : POS_COLORS.warningText },
            ]}
          >
            <Text
              style={[
                styles.bannerActionLabel,
                { color: isError ? POS_COLORS.errorText : POS_COLORS.warningText },
              ]}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        style={styles.bannerClose}
      >
        <Ionicons name="close" size={24} color={POS_COLORS.ink} />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------- styles

const styles = StyleSheet.create({
  bigButton: {
    minHeight: POS_SIZES.buttonHeight,
    borderRadius: POS_SIZES.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  bigButtonLabel: {
    color: POS_COLORS.surface,
    fontSize: POS_FONT.big,
    fontWeight: '800',
  },
  chip: {
    minWidth: 64,
    height: POS_SIZES.chipHeight,
    borderRadius: POS_SIZES.chipHeight / 2,
    borderWidth: 2,
    borderColor: POS_COLORS.line,
    backgroundColor: POS_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: POS_COLORS.primary,
    borderColor: POS_COLORS.primary,
  },
  chipLabel: {
    fontSize: POS_FONT.body,
    fontWeight: '700',
    color: POS_COLORS.ink,
  },
  chipLabelActive: {
    color: POS_COLORS.surface,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: POS_SIZES.stepperButton,
    height: POS_SIZES.stepperButton,
    borderRadius: POS_SIZES.radius,
    backgroundColor: POS_COLORS.keyBg,
    borderWidth: 1,
    borderColor: POS_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPrimary: {
    backgroundColor: POS_COLORS.primary,
    borderColor: POS_COLORS.primary,
  },
  qtyValue: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginHorizontal: 6,
  },
  qtyText: {
    fontSize: POS_FONT.big,
    fontWeight: '800',
    color: POS_COLORS.ink,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: POS_SIZES.radius,
    borderWidth: 2,
  },
  bannerBody: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: POS_FONT.body,
    fontWeight: '800',
  },
  bannerMessage: {
    marginTop: 2,
    fontSize: POS_FONT.label,
    color: POS_COLORS.inkMuted,
  },
  bannerAction: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerActionLabel: {
    fontSize: POS_FONT.label,
    fontWeight: '800',
  },
  bannerClose: {
    padding: 4,
  },
});
