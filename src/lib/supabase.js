import { createClient } from "@supabase/supabase-js";

// Extraído de unico-os-main/src/lib/supabase.js
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// CORRECCIÓN: Fallback dinámico para evitar el error de "Invalid API Key"
const key = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn("Supabase credentials missing in client-side. Check Vercel env vars.");
}

export const supabase = createClient(url || "", key || "");
