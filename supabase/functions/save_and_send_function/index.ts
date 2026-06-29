import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library";

// ── CORS headers (allow ESP32 + browser dashboard) ──────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Map water_level string → numeric (matches water_events schema) ──
function waterLevelToNumeric(level: string | undefined): number {
  switch ((level ?? "").toUpperCase()) {
    case "NO_WATER":  return 0;
    case "WATER_LOW": return 1;
    case "WATER_MED": return 2;
    case "WATER_HIGH":return 3;
    default:           return 0;
  }
}

// ══════════════════════════════════════════════════════════════
//  Firebase Cloud Messaging (FCM) HTTP v1 API
// ══════════════════════════════════════════════════════════════

async function getFirebaseAccessToken(): Promise<{ token: string; expiry: number }> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
  const privateKey  = Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, "\n");

  const jwt = new JWT({
    email:  clientEmail,
    key:    privateKey,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const { access_token, expiry_date } = await jwt.authorize();
  return {
    token: access_token as string,
    expiry: expiry_date ?? Date.now() + 55 * 60 * 1000,
  };
}

let firebaseAccessToken: string | null = null;
let firebaseTokenExpiry = 0;

async function getCachedFirebaseAccessToken(): Promise<string> {
  const refreshBufferMs = 5 * 60 * 1000;
  if (firebaseAccessToken && Date.now() < firebaseTokenExpiry - refreshBufferMs) {
    return firebaseAccessToken;
  }
  const { token, expiry } = await getFirebaseAccessToken();
  firebaseAccessToken = token;
  firebaseTokenExpiry = expiry;
  return token;
}

async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ success: boolean; response: unknown }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message: Record<string, unknown> = {
    token: fcmToken,
    notification: { title, body },
    android: {
      priority: "HIGH",
      notification: { channel_id: "water_alerts", sound: "default" },
    },
    apns: { payload: { aps: { sound: "default" } } },
  };
  if (data) message.data = data;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const result = await res.json();
  return { success: res.ok, response: result };
}

// ══════════════════════════════════════════════════════════════
//  Telegram Bot API
// ══════════════════════════════════════════════════════════════

async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Telegram] sendMessage failed for chat_id=${chatId}:`, err);
    return false;
  }

  console.log(`[Telegram] Message sent to chat_id=${chatId}`);
  return true;
}

function buildTelegramMessage(eventType: string, waterLevel: string | undefined): string {
  const isArrived = eventType === "arrived";
  const level = (waterLevel ?? "NO_WATER").toUpperCase();
  const levelLabel =
    level === "WATER_HIGH" ? "🔵 High"   :
    level === "WATER_MED"  ? "🟡 Medium" :
    level === "WATER_LOW"  ? "🟠 Low"    :
                             "⚫ None";

  if (isArrived) {
    return (
      `💧 <b>Water Supply Arrived!</b>\n\n` +
      `Water is now flowing to your area.\n` +
      `📊 Level: ${levelLabel}\n\n` +
      `<i>Water Alert System</i>`
    );
  } else {
    return (
      `🚫 <b>Water Supply Stopped</b>\n\n` +
      `Municipal water supply has been cut.\n` +
      `🪣 Store water now!\n\n` +
      `<i>Water Alert System</i>`
    );
  }
}

// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed — use POST" }),
      { status: 405, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Accept both mac_hash and mac_id for backward compatibility
  let macHash = (body.mac_hash as string | undefined)?.trim();
  if (!macHash) macHash = (body.mac_id as string | undefined)?.trim() ?? "";

  const sensorVal  = body.sensor_value as number | undefined;
  const waterLevel = body.water_level  as string | undefined;
  const uptimeSec  = body.uptime_sec   as number | undefined;
  const detectedAt = body.detected_at  as string | undefined;
  const eventType  = (body.event_type  as string | undefined) ?? "arrived";

  if (!macHash) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing required field: mac_hash (or mac_id)" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  console.log("[ESP32] Received payload:", { macHash, sensorVal, waterLevel, uptimeSec, detectedAt, eventType });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Step 1: Look up / upsert device ──────────────────────
  const { data: existingDevice, error: lookupError } = await supabase
    .from("devices")
    .select("id, mac_hash")
    .eq("mac_hash", macHash)
    .maybeSingle();

  if (lookupError) {
    console.error("[DB] Device lookup failed:", lookupError);
    return new Response(
      JSON.stringify({ ok: false, error: "Device lookup failed", detail: lookupError.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let deviceId: string;
  const macClean = macHash.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  const modelId  = "WD" + macClean.slice(-6);

  if (existingDevice) {
    deviceId = existingDevice.id;
    await supabase
      .from("devices")
      .update({ status: "online", last_seen: new Date().toISOString() })
      .eq("id", deviceId);
    console.log("[DB] Device updated. id=", deviceId);
  } else {
    const { data: upserted, error: upsertError } = await supabase
      .from("devices")
      .upsert(
        { mac_hash: macHash, model_id: modelId, status: "online", last_seen: new Date().toISOString() },
        { onConflict: "model_id", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (upsertError || !upserted) {
      console.error("[DB] Device upsert failed:", upsertError);
      const { data: byModel } = await supabase
        .from("devices").select("id").eq("model_id", modelId).maybeSingle();
      if (!byModel) {
        return new Response(
          JSON.stringify({ ok: false, error: "Device upsert failed", detail: upsertError?.message }),
          { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
      deviceId = byModel.id;
      console.log("[DB] Device found by model_id fallback. id=", deviceId);
    } else {
      deviceId = upserted.id;
      console.log("[DB] Device upserted. id=", deviceId, "model_id=", modelId);
    }
  }

  // ── Step 2: Insert water event ────────────────────────────
  const baseEventRow: Record<string, unknown> = {
    device_id:   deviceId,
    water_level: waterLevelToNumeric(waterLevel),
    detected_at: detectedAt ?? new Date().toISOString(),
  };
  const fullEventRow = { ...baseEventRow };
  if (uptimeSec !== undefined && uptimeSec !== null) fullEventRow.uptime_sec = uptimeSec;
  if (eventType) fullEventRow.event_type = eventType;
  if (sensorVal !== undefined && sensorVal !== null) fullEventRow.sensor_value = sensorVal;

  let eventData, eventError;
  const insertRes = await supabase.from("water_events").insert(fullEventRow).select("id").single();
  eventData  = insertRes.data;
  eventError = insertRes.error;

  if (eventError && eventError.code === "42703") {
    console.warn("[DB] Extra columns not found. Retrying with base columns only.");
    const retryRes = await supabase.from("water_events").insert(baseEventRow).select("id").single();
    eventData  = retryRes.data;
    eventError = retryRes.error;
  }

  if (eventError || !eventData) {
    console.error("[DB] Event insert failed:", eventError);
    return new Response(
      JSON.stringify({ ok: false, error: "Event insert failed", detail: eventError?.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  console.log("[DB] Water event saved. event_id=", eventData.id);

  // ── Step 3: Notify only on state change ──────────────────
  try {
    const { data: previousEvent } = await supabase
      .from("water_events")
      .select("event_type")
      .eq("device_id", deviceId)
      .neq("id", eventData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousEventType = previousEvent?.event_type as string | undefined;

    if (previousEventType && previousEventType === eventType) {
      console.log(`[Notify] Skipping — no state change (${previousEventType} → ${eventType})`);
    } else {
      console.log(`[Notify] State changed (${previousEventType ?? "none"} → ${eventType}). Sending notifications…`);

      // ── Step 3a: Find users linked to this device ─────────
      const { data: userLinks, error: linkError } = await supabase
        .from("user_device")
        .select("user_id")
        .eq("device_id", deviceId);

      if (linkError) {
        console.warn("[Notify] Could not fetch user_device links:", linkError.message);
      } else if (!userLinks || userLinks.length === 0) {
        console.log("[Notify] No users linked to device:", deviceId);
      } else {
        const userIds = userLinks.map((row: { user_id: string }) => row.user_id);
        console.log(`[Notify] Found ${userIds.length} linked user(s).`);

        // ── Step 3b: Build notification content ──────────────
        const isArrived = eventType === "arrived";
        const title = isArrived ? "💧 Water Available" : "🚰 Water Supply Stopped";
        const levelText = (() => {
          switch ((waterLevel ?? "NO_WATER").toUpperCase()) {
            case "WATER_HIGH": return "HIGH";
            case "WATER_MED":  return "MEDIUM";
            case "WATER_LOW":  return "LOW";
            default:           return "NO WATER";
          }
        })();
        const notifBody = isArrived
          ? `Water has arrived. Level: ${levelText}`
          : "Municipal water supply has stopped.";

        const notifData: Record<string, string> = {
          event_type:  eventType,
          water_level: waterLevel ?? "NO_WATER",
          device_id:   deviceId,
        };

        // ── Step 3c: FCM fan-out ──────────────────────────────
        try {
          let { data: tokenRows, error: tokenError } = await supabase
            .from("mobile_push_tokens")
            .select("id, fcm_token, user_id")
            .eq("is_active", true)
            .in("user_id", userIds);

          if (tokenError && tokenError.code === "42703") {
            console.warn("[FCM] is_active column missing. Retrying without filter.");
            const retry = await supabase
              .from("mobile_push_tokens")
              .select("id, fcm_token, user_id")
              .in("user_id", userIds);
            tokenRows  = retry.data;
            tokenError = retry.error;
          }

          if (tokenError) {
            console.warn("[FCM] Could not fetch tokens:", tokenError.message);
          } else if (tokenRows && tokenRows.length > 0) {
            console.log(`[FCM] Sending to ${tokenRows.length} token(s)…`);

            const projectId   = Deno.env.get("FIREBASE_PROJECT_ID")!;
            const accessToken = await getCachedFirebaseAccessToken();
            const expiredIds: string[] = [];

            await Promise.allSettled(
              tokenRows.map(async (row: { id: string; fcm_token: string; user_id: string }) => {
                try {
                  const { success, response } = await sendFCMNotification(
                    accessToken, projectId, row.fcm_token, title, notifBody, notifData,
                  );
                  console.log(`[FCM] user=${row.user_id} success=${success}`, JSON.stringify(response));

                  if (!success) {
                    const err = response as { error?: { status?: string; details?: Array<{ errorCode?: string }> } };
                    const errorCode = err?.error?.details?.[0]?.errorCode;
                    if (
                      errorCode === "UNREGISTERED" ||
                      errorCode === "INVALID_ARGUMENT" ||
                      err?.error?.status === "NOT_FOUND"
                    ) expiredIds.push(row.id);
                  }
                } catch (e) {
                  console.error("[FCM] Failed for token:", row.id, e);
                }
              })
            );

            if (expiredIds.length > 0) {
              await supabase.from("mobile_push_tokens").delete().in("id", expiredIds);
              console.log("[FCM] Removed", expiredIds.length, "expired token(s).");
            }
          } else {
            console.log("[FCM] No tokens found for linked users.");
          }
        } catch (fcmErr) {
          console.error("[FCM] Fan-out error (non-fatal):", fcmErr);
        }

        // ── Step 3d: Telegram fan-out ─────────────────────────
        try {
          const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

          if (!telegramBotToken) {
            console.warn("[Telegram] TELEGRAM_BOT_TOKEN not set — skipping.");
          } else {
            const { data: profiles, error: profileError } = await supabase
              .from("profiles")
              .select("id, chat_id")
              .in("id", userIds)
              .not("chat_id", "is", null);

            if (profileError) {
              console.warn("[Telegram] Could not fetch profiles:", profileError.message);
            } else if (!profiles || profiles.length === 0) {
              console.log("[Telegram] No Telegram-linked users for this device.");
            } else {
              console.log(`[Telegram] Sending to ${profiles.length} user(s)…`);
              const msg = buildTelegramMessage(eventType, waterLevel);

              await Promise.allSettled(
                profiles.map(async (p: { id: string; chat_id: string }) => {
                  try {
                    await sendTelegramMessage(telegramBotToken, p.chat_id, msg);
                  } catch (e) {
                    console.error("[Telegram] Failed for user:", p.id, e);
                  }
                })
              );
            }
          }
        } catch (tgErr) {
          console.error("[Telegram] Fan-out error (non-fatal):", tgErr);
        }
      }
    }
  } catch (notifyErr) {
    console.error("[Notify] Fan-out error (non-fatal):", notifyErr);
  }

  // ── Step 4: Success response ──────────────────────────────
  return new Response(
    JSON.stringify({
      ok:         true,
      event_id:   eventData.id,
      device_id:  deviceId,
      mac_hash:   macHash,
      uptime_sec: uptimeSec ?? null,
      event_type: eventType,
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
