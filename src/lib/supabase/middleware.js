import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Routes reachable without a session. Everything else redirects to /login. */
const PUBLIC_ROUTES = ['/login', '/signup', '/auth', '/forgot-password', '/reset-password'];

const isPublic = (pathname) => PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

/**
 * Refreshes the auth token on every request and gates protected routes.
 *
 * Access tokens are short-lived; without this the user is silently signed
 * out mid-session. The refreshed cookies must be copied onto the response
 * that is actually returned, which is why the response object is threaded
 * through rather than recreated.
 */
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Revalidates the token against Supabase — do not swap this for getSession().
  // If Supabase is unreachable we fall through as "no user": the site keeps
  // serving its public routes instead of 500-ing, and protected routes stay
  // protected because an unverified request is never treated as signed in.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Send them back where they were headed once they sign in.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users have no business on the login or signup screens.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
