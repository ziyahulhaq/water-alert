import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
//  Web Push Utilities (Deno-native, no npm — RFC 8291 / RFC 8188)
// ══════════════════════════════════════════════════════════════

function urlB64Decode(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ToUrlB64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

/**
 * Sign a VAPID JWT for the given push endpoint.
 * Returns the full "vapid t=<jwt>,k=<pubKey>" Authorization header value.
 */
async function vapidAuth(
  endpoint: string,
  vapidPublicKey: string,   // base64url uncompressed P-256 point (65 bytes)
  vapidPrivateKey: string,  // base64url raw EC scalar (32 bytes)
  vapidSubject: string,     // e.g. "mailto:admin@example.com"
): Promise<string> {
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const toB64url = (s: string) =>
    btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const header  = toB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = toB64url(JSON.stringify({ aud: audience, exp, sub: vapidSubject }));
  const signing = `${header}.${payload}`;

  // Build JWK from raw private key + uncompressed public key
  const pubBytes = urlB64Decode(vapidPublicKey);
  const jwk = {
    kty: "EC", crv: "P-256", ext: true,
    d: vapidPrivateKey,
    x: uint8ToUrlB64(pubBytes.slice(1, 33)),
    y: uint8ToUrlB64(pubBytes.slice(33, 65)),
  };
  const signingKey = await crypto.subtle.importKey(
    "jwk", jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(signing)
  );

  const jwt = `${signing}.${uint8ToUrlB64(new Uint8Array(sig))}`;
  return `vapid t=${jwt},k=${vapidPublicKey}`;
}

/**
 * Encrypt a push payload string following RFC 8291 (aes128gcm content-encoding).
 *  - p256dhB64 : subscriber's public key from PushSubscription.keys.p256dh
 *  - authB64   : subscriber's auth secret from PushSubscription.keys.auth
 */
async function encryptPayload(
  message: string,
  p256dhB64: string,
  authB64: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  // 1. Random 16-byte salt for this message
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 2. Import receiver's public key
  const receiverRaw = urlB64Decode(p256dhB64);
  const receiverKey = await crypto.subtle.importKey(
    "raw", receiverRaw, { name: "ECDH", namedCurve: "P-256" }, true, []
  );

  // 3. Generate ephemeral sender key pair
  const senderPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const senderRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", senderPair.publicKey)
  );

  // 4. ECDH shared secret (256 bits)
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverKey }, senderPair.privateKey, 256
  );

  // 5. First HKDF: Extract+Expand with auth as salt → IKM
  //    IKM = HKDF-SHA256( salt=auth_secret, IKM=ecdh_secret,
  //                       info="WebPush: info\0" || receiverPub || senderPub )
  const ecdhKey = await crypto.subtle.importKey(
    "raw", ecdhBits, { name: "HKDF" }, false, ["deriveBits"]
  );
  const webpushInfo = concat(
    enc.encode("WebPush: info\0"), receiverRaw, senderRaw
  );
  const ikm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: urlB64Decode(authB64), info: webpushInfo },
    ecdhKey, 256
  );

  // 6. Second HKDF with per-message salt → CEK (128 bit) + NONCE (96 bit)
  const ikmKey = await crypto.subtle.importKey(
    "raw", ikm, { name: "HKDF" }, false, ["deriveBits"]
  );
  const [cekBits, nonceBits] = await Promise.all([
    crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") },
      ikmKey, 128
    ),
    crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") },
      ikmKey, 96
    ),
  ]);

  // 7. Encrypt plaintext + \x02 padding delimiter with AES-128-GCM
  const cek = await crypto.subtle.importKey(
    "raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]
  );
  const plaintext = concat(enc.encode(message), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits }, cek, plaintext)
  );

  // 8. Build aes128gcm content header:
  //    salt(16) | rs(4 BE uint32) | idlen(1) | senderPub(65) | ciphertext
  const header = new Uint8Array(16 + 4 + 1 + senderRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);  // record size = 4096
  header[20] = senderRaw.length;                           // idlen = 65
  header.set(senderRaw, 21);

  return concat(header, ciphertext);
}

/**
 * Send a single Web Push notification.
 * Returns the HTTP status from the push service (201 = success, 410 = expired).
 */
async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: Record<string, unknown>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<number> {
  const [authorization, body] = await Promise.all([
    vapidAuth(endpoint, vapidPublicKey, vapidPrivateKey, vapidSubject),
    encryptPayload(JSON.stringify(payload), p256dh, auth),
  ]);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:      authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type":     "application/octet-stream",
      TTL:                "86400",
    },
    body,
  });

  return res.status;
}

// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {

  // ── Handle CORS preflight ──────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // ── Only accept POST ───────────────────────────────────────
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed — use POST" }),
      { status: 405, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── Parse body ────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── Extract & validate fields ─────────────────────────────
  // Accept both mac_hash and mac_id for backward compatibility with older ESP32 code
  let macHash = (body.mac_hash as string | undefined)?.trim();
  if (!macHash) {
    macHash = (body.mac_id as string | undefined)?.trim() ?? "";
  }
  
  const sensorVal  = body.sensor_value as number | undefined;
  const waterLevel = body.water_level  as string | undefined;
  const uptimeSec  = body.uptime_sec   as number | undefined;
  const detectedAt = body.detected_at  as string | undefined;   // ISO 8601
  const eventType  = (body.event_type  as string | undefined) ?? "arrived";

  if (!macHash) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing required field: mac_hash (or mac_id)" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  console.log("[ESP32] Received payload:", {
    macHash, sensorVal, waterLevel, uptimeSec, detectedAt, eventType
  });

  // ── Supabase admin client (uses service role key — bypasses RLS) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Step 1: Look up existing device by mac_hash ───────────
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

  // ── Derive model_id from MAC (matches firmware: "WD" + last 6 hex chars) ──
  const macClean = macHash.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  const modelId  = "WD" + macClean.slice(-6);

  if (existingDevice) {
    // ── Device found by mac_hash — just update last_seen ─────
    deviceId = existingDevice.id;
    await supabase
      .from("devices")
      .update({ status: "online", last_seen: new Date().toISOString() })
      .eq("id", deviceId);
    console.log("[DB] Device updated. id=", deviceId);

  } else {
    // ── Not found by mac_hash — upsert on model_id ───────────
    // Handles: brand-new device OR mac_hash mismatch on existing device
    const { data: upserted, error: upsertError } = await supabase
      .from("devices")
      .upsert(
        {
          mac_hash:  macHash,
          model_id:  modelId,
          status:    "online",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "model_id", ignoreDuplicates: false }  // update on conflict
      )
      .select("id")
      .single();

    if (upsertError || !upserted) {
      console.error("[DB] Device upsert failed:", upsertError);
      // Last resort: look up by model_id directly
      const { data: byModel } = await supabase
        .from("devices")
        .select("id")
        .eq("model_id", modelId)
        .maybeSingle();

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
    device_id:    deviceId,
    water_level:  waterLevelToNumeric(waterLevel),
    detected_at:  detectedAt ?? new Date().toISOString(),
  };

  const fullEventRow = { ...baseEventRow };

  // Only add these if they exist in the payload
  if (uptimeSec !== undefined && uptimeSec !== null) {
    fullEventRow.uptime_sec = uptimeSec;
  }
  if (eventType) {
    fullEventRow.event_type = eventType;
  }
  if (sensorVal !== undefined && sensorVal !== null) {
    fullEventRow.sensor_value = sensorVal;
  }

  let eventData, eventError;
  
  // Try inserting with all extra columns first
  const res = await supabase
    .from("water_events")
    .insert(fullEventRow)
    .select("id")
    .single();
    
  eventData = res.data;
  eventError = res.error;

  // If it failed because the extra columns don't exist yet, retry with base columns
  if (eventError && eventError.code === '42703') { // 42703 is Postgres code for "undefined_column"
    console.warn("[DB] Extra columns not found in water_events. Retrying with base columns only.");
    const retryRes = await supabase
      .from("water_events")
      .insert(baseEventRow)
      .select("id")
      .single();
      
    eventData = retryRes.data;
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

  // ── Step 3: Web Push fan-out ──────────────────────────────
  // Read VAPID credentials from edge-function secrets
  const vapidPublicKey  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const vapidSubject    = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:admin@wateralert.app";

  if (vapidPublicKey && vapidPrivateKey) {
    try {
      // Find all push subscriptions for users linked to this device
      const { data: subs, error: subError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .in(
          "user_id",
          supabase
            .from("user_device")
            .select("user_id")
            .eq("device_id", deviceId)
        );

      if (subError) {
        console.warn("[Push] Could not load subscriptions:", subError.message);
      } else if (subs && subs.length > 0) {
        // Build notification payload
        const isArrived = eventType === "arrived";
        const levelLabel =
          waterLevel === "NO_WATER"   ? "No Water" :
          waterLevel === "WATER_LOW"  ? "Low"      :
          waterLevel === "WATER_MED"  ? "Medium"   :
          waterLevel === "WATER_HIGH" ? "High"     : "No Water";

        const pushPayload = {
          title: isArrived ? "💧 Water Supply Arrived!" : "🚫 Water Supply Stopped",
          body: isArrived
            ? `Water is now flowing. Level: ${levelLabel}`
            : "Municipal water supply has been cut. Store water now.",
          icon: "/icon-192.png",
          badge: "/favicon-32.png",
          tag: "water-status",
          url: "/",
          event_type: eventType,
          water_level: waterLevel,
        };

        console.log(`[Push] Sending to ${subs.length} subscription(s)…`);

        const expiredIds: string[] = [];

        await Promise.allSettled(
          subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
            try {
              const status = await sendWebPush(
                sub.endpoint,
                sub.p256dh,
                sub.auth,
                pushPayload,
                vapidPublicKey,
                vapidPrivateKey,
                vapidSubject,
              );
              console.log(`[Push] endpoint=${sub.endpoint.slice(0, 40)}… status=${status}`);

              // 410 = subscription expired / unsubscribed — remove from DB
              if (status === 410 || status === 404) {
                expiredIds.push(sub.id);
              }
            } catch (err) {
              console.error("[Push] Failed for subscription:", sub.id, err);
            }
          })
        );

        // Clean up expired subscriptions
        if (expiredIds.length > 0) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .in("id", expiredIds);
          console.log("[Push] Removed", expiredIds.length, "expired subscription(s).");
        }
      } else {
        console.log("[Push] No push subscriptions found for device:", deviceId);
      }
    } catch (pushErr) {
      // Never let push errors block the success response to the ESP32
      console.error("[Push] Fan-out error (non-fatal):", pushErr);
    }
  } else {
    console.warn("[Push] VAPID keys not configured — skipping push notifications.");
  }

  // ── Step 4: Success response ──────────────────────────────
  return new Response(
    JSON.stringify({
      ok:        true,
      event_id:  eventData.id,
      device_id: deviceId,
      mac_hash:  macHash,
      uptime_sec: uptimeSec ?? null,
      event_type: eventType,
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
