import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only client with the secret key: writes renders and signs download URLs.
let admin: SupabaseClient | null = null;

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function supabaseAdmin(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error('Supabase is not configured');
  admin ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
