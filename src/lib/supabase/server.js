import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Still the anon key — RLS applies. The session comes from the auth cookie,
 * so the database sees the real user and their policies.
 *
 * Server Components cannot set cookies, so the `setAll` write is allowed to
 * fail there; middleware refreshes the session on every request instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — middleware handles the refresh.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null.
 *
 * Always `getUser()`, never `getSession()`: getSession reads the cookie without
 * verifying it, so a forged cookie would look valid. getUser revalidates the
 * token against Supabase.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * The signed-in user, their identity profile, and the tenant they are
 * acting in.
 *
 * Roles no longer live on `profiles` — a role is meaningless without
 * naming the organization it applies to, so it comes from the
 * organization_memberships row. See lib/tenant/context.js.
 */
export { getTenantContext, isOwner, isStaff } from '@/lib/tenant/context';

export default createClient;
