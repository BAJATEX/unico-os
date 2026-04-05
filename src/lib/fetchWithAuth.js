import { supabase } from "@/lib/supabase";

export async function fetchWithAuth(url, options = {}) {
  if (!supabase) {
    throw new Error("Supabase no inicializado");
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error("Error obteniendo sesión: " + error.message);
  }

  const token = session?.access_token;

  if (!token) {
    throw new Error("No session token found");
  }

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}