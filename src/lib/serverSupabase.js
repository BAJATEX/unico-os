import { createClient } from "@supabase/supabase-js";

// =========================================================
// UNICOS - SERVER SUPABASE CONNECTION (BACK-END)
// =========================================================

// 1. URL Fija y Permanente de Score Store
const url = "https://lpbzndnavkbpxwnlbqgb.supabase.co";

// 2. Llave Secreta (Service Role / Secret Key). 
// Esta SIEMPRE debe venir del entorno de Netlify (variables de producción).
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Cliente server-side con SECRET KEY.
 * OJO: Este archivo NO debe importarse en componentes del Front-end (page.js).
 * Solo para rutas API (ej. /api/orders/update).
 */
export function serverSupabase() {
  if (!secretKey) {
    throw new Error("⚠️ Falla Crítica: Falta SUPABASE_SECRET_KEY en las variables de Netlify.");
  }
  
  return createClient(url, secretKey, {
    auth: { 
      persistSession: false, 
      autoRefreshToken: false, 
      detectSessionInUrl: false 
    }
  });
}

/**
 * Verifica un token JWT real y regresa el usuario validado.
 * - token: access_token (Bearer) extraído de los headers.
 */
export async function requireUserFromToken(sb, token) {
  if (!token) return { user: null, error: "Missing Bearer token" };

  // supabase-js v2 soporta auth.getUser(token) para seguridad server-side real
  const { data, error } = await sb.auth.getUser(token);
  
  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid token" };
  }

  return { user: data.user, error: null };
}