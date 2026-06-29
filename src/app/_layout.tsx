// ─── Root Layout ─────────────────────────────────────────────────────────────
// Main router wrapper with auth state gating and providers
import { AppColors } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import {
  getFCMToken,
  initializeNotifications,
  setupFirebaseForegroundListener,
  setupNotificationListeners,
} from "@/lib/notifications";
import { db } from "@/lib/storage-client";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";

// ── Module-level notification init ───────────────────────────────────────────
// Must run before React renders so the foreground handler is registered
// before any notification can arrive.
initializeNotifications();

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
          {
            onConflict: "user_id",
          }
        );

        if (error) {
          console.error("Error saving FCM token:", error);
        } else {
          console.log("Successfully saved FCM token for user:", user.id);
        }
      } catch (err) {
        console.error("Failed to initialize or save FCM token:", err);
      }
    }

    saveNotificationToken();
  }, [user, loading]);

  // ── Notification listeners (foreground + tap) ──────────────────────────
  useEffect(() => {
    // expo-notifications listeners (received + response)
    const cleanupExpoListeners = setupNotificationListeners();

    // Firebase onMessage → schedule local notification in foreground
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
      // Not signed in → redirect to login
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Signed in but on auth screen → redirect to dashboard
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppColors.bgPrimary },
        animation: "fade",
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="pair-device"
        options={{
          presentation: "modal",
          headerShown: true,
          headerTitle: "Pair Device",
          headerStyle: { backgroundColor: AppColors.bgSecondary },
          headerTintColor: AppColors.textPrimary,
          headerTitleStyle: { fontWeight: "600" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={AppColors.bgPrimary} />
      <AuthGate />
    </AuthProvider>
  );
}
