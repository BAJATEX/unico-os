import { createClient } from "@supabase/supabase-js";

// Credenciales fijadas en el cliente (Prevención de errores de Netlify)
const url = "https://lpbzndnavkbpxwnlbqgb.supabase.co";
// La verdadera llave ANÓNIMA PÚBLICA de Supabase
const publicKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYnpuZG5hdmticHh3bmxicWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODAxMzMsImV4cCI6MjA4NDI1NjEzM30.YWmep-xZ6LbCBlhgs29DvrBafxzd-MN6WbhvKdxEeqE";

if (!url || !publicKey) {
  console.error("⚠️ Falla Crítica: Faltan credenciales públicas de Supabase.");
}

export const supabase = createClient(url, publicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});