import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Faltan variables de entorno de Supabase");
}

/**
 * Cliente público (browser):
 * - SOLO anon key
 * - Requiere RLS en Supabase
 */
export const supabase = createClient(url, anonKey, {
  global: {
    headers: {
      "x-client-info": "unicos-admin-web",
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPABASE_CONFIGURED = true;