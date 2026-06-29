// ─── Auth Stack Layout ───────────────────────────────────────────────────────
// Stack navigator for unauthenticated screens (login, register)

import { Stack } from 'expo-router';
import { AppColors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppColors.bgPrimary },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
