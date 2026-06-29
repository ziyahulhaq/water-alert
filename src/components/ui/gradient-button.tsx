// ─── Gradient Button Component ───────────────────────────────────────────────
// Premium gradient button with press animation

import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  colors?: readonly [string, string, ...string[]];
  disabled?: boolean;
  loading?: boolean;
  icon?: string; // emoji
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'danger';
}

const VARIANT_COLORS = {
  primary: ['#2563EB', '#3B82F6'] as [string, string],
  secondary: ['#374151', '#4B5563'] as [string, string],
  danger: ['#DC2626', '#EF4444'] as [string, string],
};

export function GradientButton({
  title,
  onPress,
  colors,
  disabled = false,
  loading = false,
  icon,
  style,
  variant = 'primary',
}: GradientButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const gradientColors = colors ?? VARIANT_COLORS[variant];

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.85}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, disabled && styles.disabled]}>
          {loading ? (
            <ActivityIndicator color={AppColors.white} size="small" />
          ) : (
            <>
              {icon && <Text style={styles.icon}>{icon}</Text>}
              <Text style={styles.text}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.white,
  },
  icon: {
    fontSize: FontSizes.lg,
  },
});
