'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_CENTRE_COOKIE } from './context';

/**
 * Switch the active centre.
 *
 * The mechanism exists so organization/centre switching can be added
 * without reworking auth; no UI calls it yet.
 *
 * The requested id is verified by SELECTing it back through RLS. If the
 * caller is not a member of that centre's organization the row does not
 * come back and the cookie is left alone — so passing another tenant's
 * centre id here achieves nothing.
 */
export async function setActiveCentre(centreId) {
  if (typeof centreId !== 'string' || centreId.length === 0) {
    return { error: 'No centre was specified.' };
  }

  const supabase = await createClient();

  const { data: centre } = await supabase
    .from('centres')
    .select('id, organization_id')
    .eq('id', centreId)
    .eq('is_active', true)
    .maybeSingle();

  if (!centre) return { error: 'That centre is not available to you.' };

  const store = await cookies();
  store.set(ACTIVE_CENTRE_COOKIE, centre.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
