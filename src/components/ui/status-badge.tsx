// ─── Status Badge Component ──────────────────────────────────────────────────
// Animated status badge pill with color, icon, and label

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

interface StatusBadgeProps {
  label: string;
  color: string;
  icon?: string; // emoji icon
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({
  label,
  color,
  icon,
  pulse = false,
  size = 'md',
}: StatusBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [pulse, pulseAnim]);

  const sizeStyles = SIZE_MAP[size];

  return (
    <View style={[styles.container, { backgroundColor: color + '20' }, sizeStyles.container]}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, opacity: pulse ? pulseAnim : 1 },
          sizeStyles.dot,
        ]}
      />
      {icon && <Text style={[styles.icon, sizeStyles.icon]}>{icon}</Text>}
      <Text style={[styles.label, { color }, sizeStyles.label]}>{label}</Text>
    </View>
  );
}

const SIZE_MAP = {
  sm: StyleSheet.create({
    container: { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
    dot: { width: 5, height: 5 },
    icon: { fontSize: 10 },
    label: { fontSize: FontSizes.xs },
  }),
  md: StyleSheet.create({
    container: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
    dot: { width: 7, height: 7 },
    icon: { fontSize: 12 },
    label: { fontSize: FontSizes.sm },
  }),
  lg: StyleSheet.create({
    container: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    dot: { width: 9, height: 9 },
    icon: { fontSize: 14 },
    label: { fontSize: FontSizes.md },
  }),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  dot: {
    borderRadius: BorderRadius.full,
  },
  icon: {
    marginLeft: 2,
  },
  label: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
