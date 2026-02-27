import { createClient } from "@supabase/supabase-js";

// =========================================================
// UNICOS - SERVER SUPABASE CONNECTION (BACK-END)
// =========================================================

const FALLBACK_URL = "https://lpbzndnavkbpxwnlbqgb.supabase.co";
const url = process.env.SUPABASE_URL || FALLBACK_URL;

const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serverSupabase() {
  if (!secretKey) {
    throw new Error(
      "⚠️ Falla Crítica: Falta SUPABASE_SECRET_KEY (sb_secret_...) en las variables de Netlify."
    );
  }

  return createClient(url, secretKey, {
    global: { headers: { "x-client-info": "unicos-admin-server" } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function requireUserFromToken(sb, token) {
  if (!token) return { user: null, error: "Missing Bearer token" };

  const { data, error } = await sb.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid token" };
  }

  return { user: data.user, error: null };
}