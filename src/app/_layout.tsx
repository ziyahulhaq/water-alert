import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider, useTheme } from "@/theme/ThemeContext";
import {
  getFCMToken,
  initializeNotifications,
  setupFirebaseForegroundListener,
  setupNotificationListeners,
} from "@/lib/notifications";
import { db } from "@/lib/storage-client";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useCallback, useState } from "react";
import { Platform, View, Animated } from "react-native";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

initializeNotifications();

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Root view background transition
  const [bgAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(bgAnim, {
      toValue: isDark ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isDark, bgAnim]);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.bg, colors.bg] // we can just use dynamic colors for screenOptions. The transition is handled inside components or by changing contentStyle but it's simpler to just let React re-render.
  });

  useEffect(() => {
    async function saveNotificationToken() {
      if (loading) return;
      if (!user) return;
      try {
        const token = await getFCMToken();
        if (!token) return;
        const { error } = await db.from("mobile_push_tokens").upsert(
          {
            user_id: user.id,
            fcm_token: token,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (error) console.error("Error saving FCM token:", error);
      } catch (err) {
        console.error("Failed to initialize or save FCM token:", err);
      }
    }
    saveNotificationToken();
  }, [user, loading]);

  useEffect(() => {
    const cleanupExpoListeners = setupNotificationListeners();
    const cleanupFirebaseListener = setupFirebaseForegroundListener();
    return () => {
      cleanupExpoListeners();
      cleanupFirebaseListener();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: "fade",
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="pair-device"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Poppins_300Light': require('@expo-google-fonts/poppins/300Light/Poppins_300Light.ttf'),
    'Poppins_400Regular': require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
    'Poppins_500Medium': require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
    'Poppins_600SemiBold': require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
    'Poppins_700Bold': require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
    'JetBrainsMono_400Regular': require('@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'),
    'JetBrainsMono_500Medium': require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
    'JetBrainsMono_700Bold': require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <StatusBar style="auto" />
          <AuthGate />
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}
