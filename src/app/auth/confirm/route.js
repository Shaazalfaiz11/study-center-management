import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing point for email links (signup confirmation, password reset).
 *
 * Supabase sends either a `token_hash` + `type` pair or a PKCE `code`
 * depending on the template, so both are handled.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalid`);
}
