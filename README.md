# UnicOs (Admin) — Score Store / Único Uniformes

Panel admin multi-tenant conectado a Supabase.

## Variables de entorno (Netlify)

Copia `.env.example` como referencia y crea estas variables en Netlify:

**Cliente (Browser):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

**Servidor (API Routes):**
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY`)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (recomendado: `gemini-2.5-flash-lite`)

## Notas rápidas
- El Service Worker NO cachea HTML ni chunks de Next.
- Unico IA ejecuta acciones reales sobre `site_settings`, `orders`, `shipping_labels`.