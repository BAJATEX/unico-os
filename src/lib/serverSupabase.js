import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  "";

export function serverSupabase() {
  if (!url) {
    throw new Error("Falta SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) en Vercel.");
  }

  if (!secretKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en Vercel.");
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-client-info": "unicos-admin-server",
      },
    },
  });
}

export async function requireUserFromToken(sb, token) {
  if (!token) {
    return { user: null, error: "Missing Bearer token" };
  }

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid token" };
  }

  return { user: data.user, error: null };
}