import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        {/* Header / Branding */}
        <View style={styles.brandingContainer}>
          <Ionicons name="water-outline" size={42} color={colors.accent} style={{ marginBottom: 16 }} />
          <Text style={[styles.appName, { color: colors.t1 }]}>WATER ALERT</Text>
          <Text style={[styles.tagline, { color: colors.t3 }]}>Sign in to monitor your supply</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.t3 }]}>EMAIL</Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: emailFocused ? colors.accent : colors.hair,
                  color: colors.t1
                }
              ]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.t3 }]}>PASSWORD</Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: passwordFocused ? colors.accent : colors.hair,
                  color: colors.t1
                }
              ]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          {error && (
            <Text style={[styles.errorText, { color: colors.alert }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.t1, opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}>
            <Text style={[styles.submitButtonText, { color: colors.bg }]}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => {}}
            activeOpacity={0.7}>
            <Text style={[styles.forgotText, { color: colors.t3 }]}>
              Forgot password?
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    letterSpacing: 0.24 * 13,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tagline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginBottom: 24,
    marginTop: -8,
  },
  submitButton: {
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  forgotLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  forgotText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
});
