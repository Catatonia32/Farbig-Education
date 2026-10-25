import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Menolak kunci rahasia agar tidak pernah ikut terkirim ke browser.
function isSecretKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;

  try {
    const payloadPart = key.split(".")[1];
    if (!payloadPart) return false;

    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")),
    );

    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export function getRealtimeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  if (isSecretKey(key)) {
    console.error(
      "[realtime] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY berisi kunci rahasia. Gunakan publishable key.",
    );
    return null;
  }

  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  return client;
}
