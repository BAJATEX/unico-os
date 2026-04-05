import { createClient } from '@supabase/supabase-js';

[span_4](start_span)// Extraído de la estructura de tu proyecto[span_4](end_span)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

[span_5](start_span)[span_6](start_span)// Corrección: Intenta leer ambas variables para evitar el error de "Invalid API Key"[span_5](end_span)[span_6](end_span)
const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Faltan variables de entorno de Supabase.');
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
);
