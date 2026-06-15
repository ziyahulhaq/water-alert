import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────
export type NotificationStatus = 'enabled' | 'disabled' | 'denied' | 'unsupported';

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Convert a base64-url string to a Uint8Array (required by pushManager.subscribe).
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer.slice(outputArray.byteOffset, outputArray.byteOffset + outputArray.byteLength);
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Returns the current notification status for this browser.
 *
 * - 'unsupported' — browser lacks Notification or PushManager APIs
 * - 'denied'      — user permanently blocked notifications
 * - 'enabled'     — permission granted AND an active push subscription exists
 * - 'disabled'    — permission not yet asked, or granted but no active subscription
 */
export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription ? 'enabled' : 'disabled';
    } catch {
      return 'disabled';
    }
  }

  return 'disabled';
}

/**
 * Full pipeline: request permission → register SW → create push subscription → save to Supabase.
 *
 * @returns The PushSubscription object on success.
 * @throws  Error with a human-readable message on any failure.
 */
export async function enablePushNotifications(): Promise<PushSubscription> {
  // 1. Feature detection
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications.');
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support service workers.');
  }
  if (!('PushManager' in window)) {
    throw new Error('This browser does not support push notifications.');
  }

  // 2. VAPID key check
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('VAPID public key is not configured. Please add VITE_VAPID_PUBLIC_KEY to your .env file.');
  }

  // 3. Request permission
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    throw new Error('Notification permission was denied. Please enable notifications in your browser settings.');
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was dismissed. Please try again.');
  }

  // 4. Get the service worker registration
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (err) {
    throw new Error(`Service worker registration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. Create push subscription
  let subscription: PushSubscription;
  try {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (err) {
    throw new Error(`Push subscription creation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to enable push notifications.');
  }

  // 7. Save to Supabase
  await savePushSubscription(user.id, subscription);

  return subscription;
}

/**
 * Persist a PushSubscription to the Supabase `push_subscriptions` table.
 * Uses upsert with (user_id, endpoint) to prevent duplicates.
 *
 * @param userId       The authenticated user's UUID.
 * @param subscription The browser PushSubscription object.
 * @throws Error on Supabase insert failure.
 */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const subJson = subscription.toJSON();
  const endpoint = subJson.endpoint;
  const p256dh = subJson.keys?.p256dh;
  const auth = subJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription: missing endpoint or keys.');
  }

  // Check if this exact subscription already exists
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (existing && existing.length > 0) {
    // Subscription already stored — nothing to do
    return;
  }

  // Insert new subscription
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
    });

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }
}
