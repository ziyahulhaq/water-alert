// ─── Shared StyleSheet Presets ───────────────────────────────────────────────
// Reusable style patterns for the glassmorphism dark theme

import { StyleSheet } from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from './theme';

export const SharedStyles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────
  screenContainer: {
    flex: 1,
    backgroundColor: AppColors.bgPrimary,
  },
  screenPadding: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ─── Glass Card ──────────────────────────────────────────────────────
  glassCard: {
    backgroundColor: AppColors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  glassCardCompact: {
    backgroundColor: AppColors.bgCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // ─── Typography ──────────────────────────────────────────────────────
  heading: {
    fontSize: FontSizes['2xl'],
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  subheading: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  body: {
    fontSize: FontSizes.md,
    color: AppColors.textSecondary,
  },
  caption: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Inputs ──────────────────────────────────────────────────────────
  textInput: {
    backgroundColor: AppColors.bgInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.bgInputBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: AppColors.textPrimary,
  },
  textInputFocused: {
    borderColor: AppColors.accentBlue,
  },

  // ─── Buttons ─────────────────────────────────────────────────────────
  primaryButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.white,
  },
  secondaryButton: {
    backgroundColor: AppColors.bgTertiary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },

  // ─── Status Badges ───────────────────────────────────────────────────
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start' as const,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Dividers ────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: AppColors.divider,
    marginVertical: Spacing.md,
  },

  // ─── Spacing helpers ─────────────────────────────────────────────────
  mt_sm: { marginTop: Spacing.sm },
  mt_md: { marginTop: Spacing.md },
  mt_lg: { marginTop: Spacing.lg },
  mt_xl: { marginTop: Spacing.xl },
  mb_sm: { marginBottom: Spacing.sm },
  mb_md: { marginBottom: Spacing.md },
  mb_lg: { marginBottom: Spacing.lg },
  gap_sm: { gap: Spacing.sm },
  gap_md: { gap: Spacing.md },
});
