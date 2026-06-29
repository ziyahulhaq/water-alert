// ─── Expanded Theme Constants ────────────────────────────────────────────────
// Premium dark glassmorphism design system for Smart Water Alert

import '@/global.css';
import { Platform } from 'react-native';

// ─── Color Palette ───────────────────────────────────────────────────────────

export const AppColors = {
  // Deep slate backgrounds
  bgPrimary: '#0A0E1A',
  bgSecondary: '#111827',
  bgTertiary: '#1A1F2E',
  bgCard: 'rgba(26, 31, 46, 0.85)',
  bgCardBorder: 'rgba(255, 255, 255, 0.08)',
  bgCardHover: 'rgba(26, 31, 46, 0.95)',
  bgInput: 'rgba(17, 24, 39, 0.9)',
  bgInputBorder: 'rgba(255, 255, 255, 0.12)',

  // Accent blues
  accentBlue: '#3B82F6',
  accentBlueBright: '#60A5FA',
  accentBlueDark: '#2563EB',
  accentBlueGlow: 'rgba(59, 130, 246, 0.25)',

  // Emerald (water available / success)
  emerald: '#10B981',
  emeraldBright: '#34D399',
  emeraldDark: '#059669',
  emeraldGlow: 'rgba(16, 185, 129, 0.25)',

  // Danger / offline / error
  danger: '#EF4444',
  dangerBright: '#F87171',
  dangerDark: '#DC2626',
  dangerGlow: 'rgba(239, 68, 68, 0.25)',

  // Amber / warning
  amber: '#F59E0B',
  amberBright: '#FBBF24',
  amberGlow: 'rgba(245, 158, 11, 0.25)',

  // Purple accent
  purple: '#8B5CF6',
  purpleGlow: 'rgba(139, 92, 246, 0.25)',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#111827',

  // Misc
  divider: 'rgba(255, 255, 255, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

// ─── Gradient Presets ────────────────────────────────────────────────────────

export const Gradients = {
  blueAccent: ['#2563EB', '#3B82F6', '#60A5FA'] as const,
  emeraldAccent: ['#059669', '#10B981', '#34D399'] as const,
  dangerAccent: ['#DC2626', '#EF4444', '#F87171'] as const,
  darkCard: ['rgba(26, 31, 46, 0.9)', 'rgba(17, 24, 39, 0.7)'] as const,
  darkBg: ['#0A0E1A', '#111827', '#0A0E1A'] as const,
  purpleBlue: ['#8B5CF6', '#3B82F6'] as const,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const FontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
  glow: (color: string) =>
    Platform.select({
      ios: {
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
} as const;

// ─── Legacy Colors export (for backward compatibility) ───────────────────────

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
