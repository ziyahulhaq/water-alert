// ─── Register Screen ─────────────────────────────────────────────────────────
// Registration form with email, password, and confirm password

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { InputField } from '@/components/ui/input-field';
import { GradientButton } from '@/components/ui/gradient-button';
import { useAuth } from '@/hooks/use-auth';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await signUp(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
    // On success, AuthProvider will detect the session and redirect
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.logoIcon}>💧</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Sign up to start monitoring your water supply
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <InputField
            label="Email Address"
            icon="📧"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <InputField
            label="Password"
            icon="🔒"
            placeholder="Min. 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <InputField
            label="Confirm Password"
            icon="🔐"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <GradientButton
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            icon="✨"
            colors={['#059669', '#10B981']}
            style={styles.submitButton}
          />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text style={styles.loginHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['4xl'],
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: AppColors.textMuted,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: AppColors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    padding: Spacing['2xl'],
  },
  errorBox: {
    backgroundColor: AppColors.danger + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: AppColors.danger + '30',
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: AppColors.danger,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  loginText: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
  },
  loginHighlight: {
    color: AppColors.accentBlue,
    fontWeight: '600',
  },
});
