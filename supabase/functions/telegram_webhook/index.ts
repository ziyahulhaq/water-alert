import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Telegram Bot Webhook — handles incoming messages from users.
 *
 * Supported commands:
 *   /start  — Welcome message with instructions
 *   /link <TOKEN>  — Links the user's Telegram chat_id to their Water Alert account
 *   /status — Tells the user whether they are linked
 *   /unlink — Removes the Telegram link from their account
 */

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const API_BASE  = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId: number | string, text: string): Promise<void> {
  await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

serve(async (req: Request) => {
  // Telegram sends POST requests for each update
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Only handle message updates
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) {
    return new Response("OK", { status: 200 });
  }

  const chatId   = (message.chat as Record<string, unknown>)?.id as number;
  const text     = (message.text as string | undefined)?.trim() ?? "";
  const from     = message.from as Record<string, unknown> | undefined;
  const username = (from?.first_name as string | undefined) ?? "there";

  if (!chatId) {
    return new Response("OK", { status: 200 });
  }

  console.log(`[Webhook] chat_id=${chatId} text="${text}"`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── /start ────────────────────────────────────────────────
  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(
      chatId,
      `👋 <b>Hello, ${username}!</b>\n\n` +
      `Welcome to the <b>Water Alert Bot</b>.\n\n` +
      `To receive water supply alerts on Telegram:\n\n` +
      `1️⃣ Open your <b>Water Alert dashboard</b>\n` +
      `2️⃣ Copy the <b>link code</b> shown there\n` +
      `3️⃣ Send it here as:\n` +
      `   <code>/link XXXXXXXX</code>\n\n` +
      `You'll get instant alerts when water arrives or stops! 💧`
    );
    return new Response("OK", { status: 200 });
  }

  // ── /link <TOKEN> ─────────────────────────────────────────
  if (text.toUpperCase().startsWith("/LINK") || text.toLowerCase().startsWith("/link")) {
    const parts = text.split(/\s+/);
    const tokenInput = (parts[1] ?? "").toUpperCase();

    if (!tokenInput) {
      await sendMessage(
        chatId,
        `⚠️ Please include your link code.\n\nExample:\n<code>/link ABCD1234</code>\n\nGet your code from the Water Alert dashboard.`
      );
      return new Response("OK", { status: 200 });
    }

    // Look up profile by first 8 chars of link_token (case-insensitive)
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, chat_id")
      .ilike("link_token", `${tokenInput}%`)
      .limit(1);

    if (error) {
      console.error("[Webhook] Profile lookup error:", error);
      await sendMessage(chatId, "❌ Something went wrong. Please try again later.");
      return new Response("OK", { status: 200 });
    }

    if (!profiles || profiles.length === 0) {
      await sendMessage(
        chatId,
        `❌ <b>Invalid code.</b>\n\nMake sure you copied it correctly from the dashboard.\n\nThe code is case-insensitive, e.g. <code>/link ABCD1234</code>`
      );
      return new Response("OK", { status: 200 });
    }

    const profile = profiles[0] as { id: string; chat_id: string | null };

    // Already linked to this same chat
    if (profile.chat_id === String(chatId)) {
      await sendMessage(chatId, "✅ Your Telegram is already linked! You will receive water alerts here.");
      return new Response("OK", { status: 200 });
    }

    // Save chat_id to profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ chat_id: String(chatId) })
      .eq("id", profile.id);

    if (updateError) {
      console.error("[Webhook] Profile update error:", updateError);
      await sendMessage(chatId, "❌ Could not link your account. Please try again.");
      return new Response("OK", { status: 200 });
    }

    console.log(`[Webhook] Linked chat_id=${chatId} to user=${profile.id}`);
    await sendMessage(
      chatId,
      `✅ <b>Telegram linked successfully!</b>\n\n` +
      `You will now receive instant alerts here when:\n` +
      `💧 Water supply <b>arrives</b>\n` +
      `🚫 Water supply <b>stops</b>\n\n` +
      `Send /status to check your link, or /unlink to disconnect.`
    );
    return new Response("OK", { status: 200 });
  }

  // ── /status ───────────────────────────────────────────────
  if (text === "/status") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, chat_id")
      .eq("chat_id", String(chatId))
      .maybeSingle();

    if (profile) {
      await sendMessage(chatId, `✅ <b>Linked</b> — You will receive water alerts here.`);
    } else {
      await sendMessage(
        chatId,
        `❌ <b>Not linked.</b>\n\nGet your code from the Water Alert dashboard and send:\n<code>/link XXXXXXXX</code>`
      );
    }
    return new Response("OK", { status: 200 });
  }

  // ── /unlink ───────────────────────────────────────────────
  if (text === "/unlink") {
    const { error: unlinkError } = await supabase
      .from("profiles")
      .update({ chat_id: null })
      .eq("chat_id", String(chatId));

    if (unlinkError) {
      await sendMessage(chatId, "❌ Could not unlink. Please try again.");
    } else {
      await sendMessage(chatId, "✅ Your Telegram has been unlinked. You will no longer receive alerts here.");
    }
    return new Response("OK", { status: 200 });
  }

  // ── Unknown command ───────────────────────────────────────
  await sendMessage(
    chatId,
    `ℹ️ <b>Available commands:</b>\n\n` +
    `/link &lt;CODE&gt; — Link your account\n` +
    `/status — Check link status\n` +
    `/unlink — Remove Telegram link\n` +
    `/start — Show welcome message`
  );

  return new Response("OK", { status: 200 });
});
