// ─── Login Screen ────────────────────────────────────────────────────────────
// Premium dark login form with email/password and animated branding

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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { InputField } from '@/components/ui/input-field';
import { GradientButton } from '@/components/ui/gradient-button';
import { useAuth } from '@/hooks/use-auth';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';
import { isMockMode } from '@/lib/storage-client';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header / Branding */}
        <View style={styles.brandingContainer}>
          <LinearGradient
            colors={['rgba(59,130,246,0.15)', 'transparent']}
            style={styles.glowOrb}
          />
          <Text style={styles.logoIcon}>💧</Text>
          <Text style={styles.appName}>Smart Water Alert</Text>
          <Text style={styles.tagline}>Monitor your water supply in real-time</Text>
        </View>

        {/* Mock Mode Badge */}
        {isMockMode && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>🧪 Demo Mode — No Supabase Connected</Text>
          </View>
        )}

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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <GradientButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            icon="→"
            style={styles.submitButton}
          />

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.7}>
            <Text style={styles.registerText}>
              Don't have an account?{' '}
              <Text style={styles.registerHighlight}>Create one</Text>
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
  brandingContainer: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
    position: 'relative',
  },
  glowOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -60,
  },
  logoIcon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSizes['3xl'],
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSizes.md,
    color: AppColors.textMuted,
  },
  mockBadge: {
    alignSelf: 'center',
    backgroundColor: AppColors.amber + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: AppColors.amber + '30',
  },
  mockBadgeText: {
    fontSize: FontSizes.xs,
    color: AppColors.amber,
    fontWeight: '600',
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
  registerLink: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  registerText: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
  },
  registerHighlight: {
    color: AppColors.accentBlue,
    fontWeight: '600',
  },
});
