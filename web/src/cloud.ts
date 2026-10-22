import { createClient } from '@supabase/supabase-js';
export const cloudApi = import.meta.env.VITE_EDGE_API_URL as string | undefined;
export const cloudAuth = cloudApi ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
