import 'server-only';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Active-centre cookie.
 *
 * It is a UX convenience only — it remembers which centre you were last
 * looking at. It is NOT a security boundary. The value is always checked
 * against centres returned by an RLS-scoped query, so a forged cookie
 * naming another tenant's centre simply fails to match and falls back to
 * a legitimate default.
 */
export const ACTIVE_CENTRE_COOKIE = 'ssc_active_centre';

/**
 * Everything the server needs to answer "who is this, and which tenant
 * are they acting in?".
 *
 * Returns null when there is no session at all. Returns a context with
 * `organization: null` when the user is signed in but belongs to no
 * active organization — a real state that must be handled, not assumed
 * away.
 *
 * The organization and role are ALWAYS derived from the database on the
 * server. Nothing here is read from a form field, query parameter, URL
 * segment or request body.
 */
export async function getTenantContext() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return null;
  const user = userData.user;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, phone, avatar_url, created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('organization_memberships')
      .select('id, role, status, centre_id, organization_id, organizations(id, name, slug)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);

  const active = memberships || [];

  if (active.length === 0) {
    return { user, profile: profile || null, memberships: [], organization: null, centre: null, centres: [], role: null };
  }

  // RLS already limits this to organizations the caller belongs to, which
  // is what makes the cookie check below trustworthy.
  const { data: centreRows } = await supabase
    .from('centres')
    .select('id, organization_id, name, code, is_active')
    .in('organization_id', active.map((m) => m.organization_id))
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  let centres = centreRows || [];

  // A membership scoped to a single centre may not roam the organization.
  const scoped = new Map(active.filter((m) => m.centre_id).map((m) => [m.organization_id, m.centre_id]));
  if (scoped.size > 0) {
    centres = centres.filter((c) => !scoped.has(c.organization_id) || scoped.get(c.organization_id) === c.id);
  }

  const store = await cookies();
  const requested = store.get(ACTIVE_CENTRE_COOKIE)?.value;

  // Match, or fall back. Never trust the cookie on its own.
  const centre = centres.find((c) => c.id === requested) || centres[0] || null;
  const membership = centre
    ? active.find((m) => m.organization_id === centre.organization_id)
    : active[0];

  return {
    user,
    profile: profile || null,
    memberships: active,
    organization: membership?.organizations || null,
    centre,
    centres,
    role: membership?.role || null,
  };
}

/** Convenience guards — the role always comes from the membership row. */
export const isOwner = (ctx) => ctx?.role === 'owner';
export const isStaff = (ctx) => Boolean(ctx?.role);
