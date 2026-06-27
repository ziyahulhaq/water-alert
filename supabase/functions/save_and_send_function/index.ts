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

  // ── Step 3: Success response ──────────────────────────────
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
