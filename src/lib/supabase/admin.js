import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * `server-only` makes the build fail if this is ever imported into a client
 * component, which is the failure mode that would leak the key to the browser.
 *
 * Only for operations a user genuinely cannot perform as themselves —
 * listing auth users for the team screen, seeding, admin scripts.
 * Never reach for it just to avoid writing an RLS policy.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — add it to .env.local (server-side only).');
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default createAdminClient;
