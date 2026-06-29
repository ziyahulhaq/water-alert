// ─── Input Field Component ───────────────────────────────────────────────────
// Styled dark text input with label, error state, and icon support

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  icon?: string; // emoji
}

export function InputField({ label, error, icon, style, ...props }: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputFocused,
          error ? styles.inputError : undefined,
        ]}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={AppColors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.bgInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: AppColors.bgInputBorder,
    paddingHorizontal: Spacing.lg,
  },
  inputFocused: {
    borderColor: AppColors.accentBlue,
  },
  inputError: {
    borderColor: AppColors.danger,
  },
  icon: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    color: AppColors.textPrimary,
    paddingVertical: Spacing.md + 2,
  },
  errorText: {
    fontSize: FontSizes.xs,
    color: AppColors.danger,
    marginTop: Spacing.xs,
  },
});
