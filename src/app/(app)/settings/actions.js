'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant/context';

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

/** "Cash, UPI , Card" -> ['Cash','UPI','Card']. Blanks and duplicates dropped. */
const toTextList = (v) => [...new Set(clean(v).split(',').map((s) => s.trim()).filter(Boolean))];

/** "7, 3, 1, 0" -> [7,3,1,0], highest first. Returns null if anything is unparseable. */
function toDayList(v) {
  const parts = clean(v).split(',').map((s) => s.trim()).filter(Boolean);
  const nums = [];
  for (const part of parts) {
    const n = Number.parseInt(part, 10);
    if (!Number.isFinite(n) || String(n) !== part || n < 0 || n > 90) return null;
    nums.push(n);
  }
  return [...new Set(nums)].sort((a, b) => b - a);
}

/**
 * Owner of the ACTIVE organization.
 *
 * The organization and centre are resolved from the session, never from
 * the submitted form. A caller cannot aim a write at another tenant by
 * adding an organization_id or centre_id field — those values are
 * ignored here and RLS would reject them regardless.
 */
async function requireOwner() {
  const ctx = await getTenantContext();
  if (!ctx?.user) return { error: 'You are not signed in.' };
  if (!ctx.organization || !ctx.centre) return { error: 'You do not have an active centre.' };
  if (ctx.role !== 'owner') return { error: 'Only an owner can change this.' };
  return { ok: true, ctx };
}

/**
 * Writes the single settings row, refusing to clobber a concurrent save.
 *
 * The form carries the updated_at it was rendered with. Matching on it
 * means a save that lands after someone else's touches zero rows instead
 * of silently overwriting them — the lost-update problem. A plain
 * .update().eq('id', 1) also reports success when it matches nothing,
 * which is why the affected rows are checked rather than just `error`.
 */
async function writeCentreSettings(centreId, patch, expectedUpdatedAt) {
  const supabase = await createClient();

  // Postgres hands back "…+00:00". A literal '+' in a query string decodes
  // as a space, so send the equivalent 'Z' form instead. Done by string
  // replacement rather than toISOString(), which truncates the microseconds
  // (…079018 -> …079) and would never compare equal.
  const version = expectedUpdatedAt ? expectedUpdatedAt.replace(/\+00:00$/, 'Z') : '';

  let query = supabase.from('centre_settings').update(patch).eq('centre_id', centreId);
  if (version) query = query.eq('updated_at', version);

  const { data, error } = await query.select('centre_id');
  if (error) return { error: error.message };

  if (!data || data.length === 0) {
    const { data: row } = await supabase
      .from('centre_settings')
      .select('centre_id')
      .eq('centre_id', centreId)
      .maybeSingle();
    if (!row) return { error: 'The centre settings row is missing, so there was nothing to update.' };
    return { error: 'Someone else saved these settings while you were editing. Reload the page, then reapply your changes.' };
  }

  return { ok: true };
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
    currency: clean(formData.get('currency')) || 'INR',
    timezone: clean(formData.get('timezone')) || 'Asia/Kolkata',
    updated_by: guard.ctx.user.id,
  };

  if (!payload.name) return { error: 'The centre needs a name.' };
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { error: 'Enter a valid centre email address, or leave it blank.' };
  }
  if (payload.phone && !/^[\d\s+()-]{6,20}$/.test(payload.phone)) {
    return { error: 'Enter a valid phone number, or leave it blank.' };
  }

  const written = await writeCentreSettings(guard.ctx.centre.id, payload, clean(formData.get('updated_at')));
  if (written.error) return { error: written.error };

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

  const offsets = toDayList(formData.get('reminder_offsets'));
  if (offsets === null) return { error: 'Reminder days must be whole numbers between 0 and 90, separated by commas.' };
  if (offsets.length === 0) return { error: 'Set at least one reminder day.' };

  const methods = toTextList(formData.get('payment_methods'));
  if (methods.length === 0) return { error: 'Keep at least one payment method.' };

  const written = await writeCentreSettings(
    guard.ctx.centre.id,
    {
      expiring_soon_days: expiring,
      inactive_attendance_days: inactive,
      grace_period_days: grace,
      reminder_offsets: offsets,
      payment_methods: methods,
      updated_by: guard.ctx.user.id,
    },
    clean(formData.get('updated_at')),
  );

  if (written.error) return { error: written.error };

  // These thresholds drive flags across the whole app, so every cached
  // page that reads them has to be invalidated, not just this one.
  revalidatePath('/', 'layout');
  return { success: 'Business rules updated.' };
}

// ── Own profile ─────────────────────────────────────────────
// Identity only. Role and status live on the membership row and are
// deliberately not writable here.
export async function updateOwnProfile(_prev, formData) {
  const ctx = await getTenantContext();
  if (!ctx?.user) return { error: 'You are not signed in.' };

  const fullName = clean(formData.get('full_name'));
  if (!fullName) return { error: 'Enter your name.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone: clean(formData.get('phone')) })
    .eq('id', ctx.user.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { success: 'Your profile is updated.' };
}

// ── Team ────────────────────────────────────────────────────
export async function updateTeamMember(_prev, formData) {
  const guard = await requireOwner();
  if (guard.error) return { error: guard.error };

  const { ctx } = guard;
  const userId = clean(formData.get('id'));
  const role = clean(formData.get('role'));
  const isActive = formData.get('is_active') === 'true';

  if (!['owner', 'front_desk', 'facilities'].includes(role)) return { error: 'Unknown role.' };

  // Removing the last owner would lock everyone out of settings for good.
  if (userId === ctx.user.id && role !== 'owner') {
    return { error: 'You cannot remove your own owner role. Promote someone else first.' };
  }

  const supabase = await createClient();

  if (role !== 'owner') {
    const { count } = await supabase
      .from('organization_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.organization.id)
      .eq('role', 'owner')
      .eq('status', 'active');
    if ((count ?? 0) <= 1) return { error: 'The organization must keep at least one active owner.' };
  }

  // Scoped to the caller's own organization. Even if a different
  // organization's user id were submitted, this matches no row — and RLS
  // would reject the write regardless.
  const { data, error } = await supabase
    .from('organization_memberships')
    .update({ role, status: isActive ? 'active' : 'suspended' })
    .eq('organization_id', ctx.organization.id)
    .eq('user_id', userId)
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'That team member is not part of your organization.' };

  revalidatePath('/settings');
  return { success: 'Team member updated.' };
}
