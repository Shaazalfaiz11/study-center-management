'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getUserProfile } from '@/lib/supabase/server';

/**
 * Settings mutations.
 *
 * Every one re-checks the caller's role on the server. The UI hides
 * owner-only controls, but hiding a button is not access control —
 * RLS is the real boundary and these checks give a clear error rather
 * than a silent policy rejection.
 */

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const toInt = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

async function requireOwner() {
  const result = await getUserProfile();
  if (!result?.user) return { error: 'You are not signed in.' };
  if (result.profile?.role !== 'owner') return { error: 'Only an owner can change this.' };
  return { ok: true, ...result };
}

// ── Centre details ──────────────────────────────────────────
export async function updateCentreSettings(_prev, formData) {
  const guard = await requireOwner();
  if (guard.error) return { error: guard.error };

  const payload = {
    name: clean(formData.get('name')),
    branch: clean(formData.get('branch')),
    address: clean(formData.get('address')),
    phone: clean(formData.get('phone')),
    email: clean(formData.get('email')),
    gstin: clean(formData.get('gstin')),
    opening_time: clean(formData.get('opening_time')),
    closing_time: clean(formData.get('closing_time')),
    updated_by: guard.user.id,
  };

  if (!payload.name) return { error: 'The centre needs a name.' };

  const supabase = await createClient();
  const { error } = await supabase.from('centre_settings').update(payload).eq('id', 1);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { success: 'Centre details saved.' };
}

// ── Business rules ──────────────────────────────────────────
export async function updateBusinessRules(_prev, formData) {
  const guard = await requireOwner();
  if (guard.error) return { error: guard.error };

  const expiring = toInt(formData.get('expiring_soon_days'), 7);
  const inactive = toInt(formData.get('inactive_attendance_days'), 7);
  const grace = toInt(formData.get('grace_period_days'), 10);

  if (expiring < 1 || expiring > 90) return { error: 'Expiring-soon must be between 1 and 90 days.' };
  if (inactive < 1 || inactive > 90) return { error: 'Idle-seat threshold must be between 1 and 90 days.' };
  if (grace < 0 || grace > 90) return { error: 'Grace period must be between 0 and 90 days.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('centre_settings')
    .update({
      expiring_soon_days: expiring,
      inactive_attendance_days: inactive,
      grace_period_days: grace,
      updated_by: guard.user.id,
    })
    .eq('id', 1);

  if (error) return { error: error.message };

  // These thresholds drive flags across the whole app, so every cached
  // page that reads them has to be invalidated, not just this one.
  revalidatePath('/', 'layout');
  return { success: 'Business rules updated.' };
}

// ── Own profile ─────────────────────────────────────────────
export async function updateOwnProfile(_prev, formData) {
  const result = await getUserProfile();
  if (!result?.user) return { error: 'You are not signed in.' };

  const fullName = clean(formData.get('full_name'));
  if (!fullName) return { error: 'Enter your name.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone: clean(formData.get('phone')) })
    .eq('id', result.user.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { success: 'Your profile is updated.' };
}

// ── Team ────────────────────────────────────────────────────
export async function updateTeamMember(_prev, formData) {
  const guard = await requireOwner();
  if (guard.error) return { error: guard.error };

  const id = clean(formData.get('id'));
  const role = clean(formData.get('role'));
  const isActive = formData.get('is_active') === 'true';

  if (!['owner', 'front_desk', 'facilities'].includes(role)) return { error: 'Unknown role.' };

  // Removing the last owner would lock everyone out of settings for good.
  if (id === guard.user.id && role !== 'owner') {
    return { error: 'You cannot remove your own owner role. Promote someone else first.' };
  }

  const supabase = await createClient();

  if (role !== 'owner') {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'owner')
      .eq('is_active', true);
    if ((count ?? 0) <= 1) return { error: 'The centre must keep at least one active owner.' };
  }

  const { error } = await supabase.from('profiles').update({ role, is_active: isActive }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { success: 'Team member updated.' };
}
