'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for browser/client components.
 *
 * Uses the anon key, so every query is subject to Row Level Security.
 * Nothing here can read data the signed-in user isn't entitled to.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export default createClient;
