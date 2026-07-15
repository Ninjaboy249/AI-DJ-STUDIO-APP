// src/lib/supabase/client.ts — Browser-side Supabase client (Next.js App Router).
// Uses @supabase/ssr's createBrowserClient for cookie-based auth.

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from '../env';

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
