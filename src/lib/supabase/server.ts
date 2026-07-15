// src/lib/supabase/server.ts — Server-side Supabase client (Next.js App Router).
// Uses @supabase/ssr's createServerClient which reads/writes cookies via Next.js
// cookies() — required for RSC and API routes.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from '../env';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();
  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cs: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
          );
        },
      },
    },
  );
}
