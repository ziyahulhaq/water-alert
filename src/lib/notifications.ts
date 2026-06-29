import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Notification Channel ─────────────────────────────────────────────────────
// Must match the `channel_id` sent from the FCM payload in save_and_send_function

const WATER_ALERTS_CHANNEL = "water_alerts";

/**
 * Create the `water_alerts` Android notification channel.
 * Importance MAX = heads-up banner + sound + vibration + wake screen.
 * This is a no-op on iOS and Android < 8.0.
 */
export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(WATER_ALERTS_CHANNEL, {
    name: "Water Alerts",
    description: "Emergency water supply notifications",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 500, 250, 500],
    enableLights: true,
    lightColor: "#3B82F6",
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  console.log("[Notifications] water_alerts channel created");
}

// ── Foreground Handler ───────────────────────────────────────────────────────
// Without this, notifications received while the app is open are silently dropped.

/**
 * Configure expo-notifications to show banners + play sound for incoming
 * notifications even when the app is in the foreground.
 *
 * MUST be called at module level (outside any React component) so it runs
 * before any notification arrives.
 */
export function setupForegroundNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  console.log("[Notifications] Foreground handler configured");
}

// ── Notification Listeners ───────────────────────────────────────────────────

/**
 * Set up listeners for:
 * 1. Notification received (foreground) — log it
 * 2. User tapped notification — log it (extend later for deep-linking)
 *
 * Returns a cleanup function to remove listeners.
 */
export function setupNotificationListeners(): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log(
        "[Notifications] Received in foreground:",
        notification.request.content.title,
        notification.request.content.body
      );
    }
  );

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log(
        "[Notifications] User tapped notification:",
        response.notification.request.content.title
      );
    }
  );

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ── Firebase Foreground Message → Local Notification ─────────────────────────

/**
 * Listen for FCM messages arriving while the app is in the foreground.
 *
 * Firebase `notification` payloads are NOT automatically displayed when the app
 * is open on Android. This listener receives them and schedules a local
 * notification via expo-notifications so the user still sees the alert.
 *
 * Returns an unsubscribe function.
 */
export function setupFirebaseForegroundListener(): () => void {
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    console.log(
      "[FCM] Foreground message received:",
      JSON.stringify(remoteMessage.notification)
    );

    const title = remoteMessage.notification?.title ?? "Water Alert";
    const body = remoteMessage.notification?.body ?? "";

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        data: remoteMessage.data ?? {},
      },
      trigger: null, // show immediately
    });
  });

  return unsubscribe;
}

// ── Combined Initialization ──────────────────────────────────────────────────

/**
 * One-call setup for the entire notification system.
 * Call at module level in _layout.tsx (before React renders).
 *
 * Sets up:
 * - Android notification channel (water_alerts)
 * - Foreground notification handler (show banners + sound)
 */
export function initializeNotifications() {
  // 1. Foreground handler — must be set before any notification arrives
  setupForegroundNotificationHandler();

  // 2. Android channel — async but fire-and-forget at init time
  setupNotificationChannel().catch((err) =>
    console.error("[Notifications] Channel setup failed:", err)
  );
}

// ── FCM Token ────────────────────────────────────────────────────────────────

export async function getFCMToken() {
  // Ask the user for notification permission
  const authStatus = await messaging().requestPermission();

  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log("Notification permission denied");
    return null;
  }

  // Get the FCM token
  const token = await messaging().getToken();

  console.log("FCM TOKEN:", token);

  return token;
}
