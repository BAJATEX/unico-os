import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serverSupabase() {
  if (!url || !serviceKey) {
    throw new Error("Supabase no configurado correctamente.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function getUserFromRequest(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return { user: null, error: "Missing token" };
  }

  const supabase = serverSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "Invalid token" };
  }

  return { user, error: null };
}