// ─── Glass Card Component ────────────────────────────────────────────────────
// Reusable glassmorphic card with semi-transparent background and border

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { AppColors, BorderRadius, Spacing } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  compact?: boolean;
  glowColor?: string;
}

export function GlassCard({ children, style, compact, glowColor }: GlassCardProps) {
  return (
    <View
      style={[
        compact ? styles.cardCompact : styles.card,
        glowColor ? { borderColor: glowColor + '40' } : undefined,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardCompact: {
    backgroundColor: AppColors.bgCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
});
