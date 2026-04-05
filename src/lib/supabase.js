import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
[span_3](start_span)// Corregido: Prioriza el JWT largo (ANON) del PDF[span_3](end_span)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check Vercel settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
