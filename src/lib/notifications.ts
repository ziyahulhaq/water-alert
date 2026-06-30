import Constants from "expo-constants";
import { Platform } from "react-native";

// ── Notification Channel ─────────────────────────────────────────────────────
// Must match the `channel_id` sent from the FCM payload in save_and_send_function

const WATER_ALERTS_CHANNEL = "water_alerts";
const hasFirebaseConfig =
  Platform.OS === "android" || Constants.expoConfig?.extra?.hasIosFirebaseConfig === true;

// Safe check for Expo Go environment
const isExpoGo =
  Constants.appOwnership === "expo" ||
  (Constants.executionEnvironment && (Constants.executionEnvironment as string) === "store-client");

// ── Lazy module loaders ───────────────────────────────────────────────────────
// Both expo-notifications (SDK 53 Expo Go) and @react-native-firebase/messaging
// throw at import time when their native modules aren't linked. We load them
// lazily so the rest of the app boots normally in Expo Go.

type ExpoNotifications = typeof import("expo-notifications");
let _notifications: ExpoNotifications | null = null;

function getNotifications(): ExpoNotifications | null {
  if (isExpoGo) {
    console.log("[Notifications] Running in Expo Go, skipping native notifications loading.");
    return null;
  }
  if (_notifications) return _notifications;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _notifications = require("expo-notifications") as ExpoNotifications;
    return _notifications;
  } catch (e) {
    console.warn("[Notifications] expo-notifications not available (Expo Go SDK 53+):", e);
    return null;
  }
}

type FirebaseMessaging = typeof import("@react-native-firebase/messaging").default;
let _messaging: FirebaseMessaging | null = null;

function getMessaging(): FirebaseMessaging | null {
  if (isExpoGo) {
    console.log("[FCM] Running in Expo Go, skipping native Firebase messaging loading.");
    return null;
  }
  if (_messaging) return _messaging;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _messaging = require("@react-native-firebase/messaging").default as FirebaseMessaging;
    return _messaging;
  } catch (e) {
    console.warn("[FCM] Firebase messaging not available:", e);
    return null;
  }
}

// ── Notification Channel ──────────────────────────────────────────────────────

/**
 * Create the `water_alerts` Android notification channel.
 * Importance MAX = heads-up banner + sound + vibration + wake screen.
 * This is a no-op on iOS, Android < 8.0, and Expo Go.
 */
export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;

  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
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
  } catch (e) {
    console.warn("[Notifications] Channel setup failed:", e);
  }
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
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    console.log("[Notifications] Foreground handler configured");
  } catch (e) {
    console.warn("[Notifications] Could not configure foreground handler:", e);
  }
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
  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  try {
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
  } catch (e) {
    console.warn("[Notifications] Could not set up listeners:", e);
    return () => {};
  }
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
  if (!hasFirebaseConfig) return () => {};

  const messagingInstance = getMessaging();
  if (!messagingInstance) return () => {};

  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  try {
    const unsubscribe = messagingInstance().onMessage(async (remoteMessage) => {
      console.log(
        "[FCM] Foreground message received:",
        JSON.stringify(remoteMessage.notification)
      );

      const title = remoteMessage.notification?.title ?? "Water Alert";
      const body = remoteMessage.notification?.body ?? "";

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: "default",
            data: remoteMessage.data ?? {},
          },
          trigger: null, // show immediately
        });
      } catch (e) {
        console.warn("[FCM] Could not schedule local notification:", e);
      }
    });

    return unsubscribe;
  } catch (e) {
    console.warn("[FCM] Could not set up foreground listener:", e);
    return () => {};
  }
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
  if (!hasFirebaseConfig) return null;

  const messagingInstance = getMessaging();
  if (!messagingInstance) {
    console.warn("[FCM] Firebase messaging unavailable, skipping token fetch.");
    return null;
  }

  try {
    // Ask the user for notification permission
    const authStatus = await messagingInstance().requestPermission();

    const enabled =
      authStatus === messagingInstance.AuthorizationStatus.AUTHORIZED ||
      authStatus === messagingInstance.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log("Notification permission denied");
      return null;
    }

    // Get the FCM token
    const token = await messagingInstance().getToken();
    console.log("FCM TOKEN:", token);
    return token;
  } catch (e) {
    console.warn("[FCM] Could not get FCM token:", e);
    return null;
  }
}
