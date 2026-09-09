import { updateSession } from '@/lib/supabase/middleware';

/**
 * Runs before every matched request: refreshes the Supabase session and
 * redirects anonymous visitors to /login.
 *
 * Next 16 renamed this convention from `middleware` to `proxy`.
 */
export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images — running an auth check
     * on those would add a Supabase round trip to every icon request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
