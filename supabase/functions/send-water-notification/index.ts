import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { JWT } from "npm:google-auth-library";

Deno.serve(async () => {
  try {
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
    const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
    const privateKey = Deno.env
      .get("FIREBASE_PRIVATE_KEY")!
      .replace(/\\n/g, "\n");

    const jwt = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/firebase.messaging",
      ],
    });

    const { access_token } = await jwt.authorize();

    // Read your token from Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/mobile_push_tokens?select=fcm_token&limit=1`,
      {
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
      }
    );

    const tokens = await response.json();

    if (!tokens.length) {
      return new Response("No FCM token found", { status: 404 });
    }

    const token = tokens[0].fcm_token;

    const send = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: "💧 Smart Water Alert",
              body: "Water is available!",
            },
          },
        }),
      }
    );

    const result = await send.json();

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: String(err),
      }),
      {
        status: 500,
      }
    );
  }
});