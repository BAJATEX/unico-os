import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

/**
 * Cliente público para navegador.
 * Si faltan variables, devuelve null para evitar romper importación
 * y permitir que la UI muestre un estado controlado.
 */
export const supabase = SUPABASE_CONFIGURED
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          "x-client-info": "unicos-admin-web",
        },
      },
    })
  : null;