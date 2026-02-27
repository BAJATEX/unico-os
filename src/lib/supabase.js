import { createClient } from "@supabase/supabase-js";

/**
 * UNICOS — Supabase client (Browser)
 * - Usa variables NEXT_PUBLIC_* si existen (recomendado)
 * - Fallback seguro a credenciales embebidas (evita pantallas en blanco si Netlify no inyecta envs)
 *
 * IMPORTANTE:
 * - Public/PUBLISHABLE/ANON key SÍ puede ir en el cliente.
 * - Secret/Service role NUNCA en el cliente.
 */

const FALLBACK_URL = "https://lpbzndnavkbpxwnlbqgb.supabase.co";
// Legacy anon (fallback). Puedes migrar a sb_publishable_* por env sin tocar código.
const FALLBACK_PUBLIC_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYnpuZG5hdmticHh3bmxicWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODAxMzMsImV4cCI6MjA4NDI1NjEzM30.YWmep-xZ6LbCBlhgs29DvrBafxzd-MN6WbhvKdxEeqE";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;

const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  FALLBACK_PUBLIC_KEY;

if (!url || !publicKey) {
  console.error(
    "⚠️ Supabase: faltan credenciales públicas (NEXT_PUBLIC_SUPABASE_URL y key)."
  );
}

export const supabase = createClient(url, publicKey, {
  global: { headers: { "x-client-info": "unicos-admin-web" } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
