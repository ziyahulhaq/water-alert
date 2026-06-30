// ─── Auth Stack Layout ───────────────────────────────────────────────────────
// Stack navigator for unauthenticated screens (login, register)

import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
