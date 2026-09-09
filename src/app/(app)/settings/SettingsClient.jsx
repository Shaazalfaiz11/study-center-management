'use client';

import { useActionState, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, SlidersHorizontal, Users, CreditCard, Clock, BadgeCheck,
  Save, Loader2, AlertCircle, CheckCircle2, ShieldAlert, Lock, ArrowRight, UserCog,
} from 'lucide-react';
import { SectionCard, StatusBadge, Avatar } from '@/components/ui/Primitives';
import { EmptyState } from '@/components/ui/StateViews';
import { useUI } from '@/context/UIContext';
import { updateCentreSettings, updateBusinessRules, updateOwnProfile, updateTeamMember } from './actions';
import './settings.css';

const TABS = [
  { key: 'centre', label: 'Centre info', icon: Building2 },
  { key: 'profile', label: 'My profile', icon: UserCog },
  { key: 'rules', label: 'Business rules', icon: SlidersHorizontal, ownerOnly: true },
  { key: 'team', label: 'Team', icon: Users, ownerOnly: true },
  { key: 'catalogue', label: 'Plans & shifts', icon: BadgeCheck },
];

const ROLE_LABELS = { owner: 'Owner', front_desk: 'Front Desk', facilities: 'Facilities' };

export default function SettingsClient({ centre, team, plans, slots, me }) {
  const isOwner = me.role === 'owner';
  const visibleTabs = TABS.filter((t) => !t.ownerOnly || isOwner);
  const [tab, setTab] = useState('centre');

  if (!centre) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Settings row not found"
        description="Run supabase/schema.sql in the Supabase SQL editor — it creates the centre_settings row this page reads."
      />
    );
  }

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {visibleTabs.map((t) => (
          <button key={t.key} type="button" className={`settings-nav-item ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {!isOwner && (
          <div className="callout callout-info">
            <Lock size={15} className="callout-icon" />
            <div>
              You are signed in as <strong>{ROLE_LABELS[me.role]}</strong>. Centre details, business rules
              and team management are owner-only — the database enforces this, not just this screen.
            </div>
          </div>
        )}

        {tab === 'centre' && <CentreForm centre={centre} canEdit={isOwner} />}
        {tab === 'profile' && <ProfileForm profile={me.profile} />}
        {tab === 'rules' && isOwner && <RulesForm centre={centre} />}
        {tab === 'team' && isOwner && <TeamPanel team={team} meId={me.id} />}
        {tab === 'catalogue' && <Catalogue plans={plans} slots={slots} />}
      </div>
    </div>
  );
}

/** Surfaces action results as a toast and an inline message. */
function useActionFeedback(state) {
  const { addToast } = useUI();
  useEffect(() => {
    if (state?.success) addToast(state.success, 'success');
    if (state?.error) addToast(state.error, 'error');
  }, [state, addToast]);
}

function SaveButton({ pending, children = 'Save changes', disabled }) {
  return (
    <button type="submit" className="btn btn-primary" disabled={pending || disabled}>
      {pending ? <Loader2 size={14} className="is-spinning" /> : <Save size={14} />}
      {pending ? 'Saving…' : children}
    </button>
  );
}

function Feedback({ state }) {
  if (state?.error) {
    return (
      <div className="settings-feedback is-error" role="alert">
        <AlertCircle size={14} /> {state.error}
      </div>
    );
  }
  if (state?.success) {
    return (
      <div className="settings-feedback is-success" role="status">
        <CheckCircle2 size={14} /> {state.success}
      </div>
    );
  }
  return null;
}

// ── Centre details ──────────────────────────────────────────
function CentreForm({ centre, canEdit }) {
  const [state, action, pending] = useActionState(updateCentreSettings, {});
  useActionFeedback(state);

  return (
    <form action={action}>
      <SectionCard title="Centre information" subtitle="Appears on receipts and invoices">
        <fieldset disabled={!canEdit} className="settings-fieldset">
          <div className="flex flex-col gap-4">
            <Feedback state={state} />

            <div className="form-row">
              <Field id="name" label="Centre name" defaultValue={centre.name} required />
              <Field id="branch" label="Branch" defaultValue={centre.branch} />
            </div>

            <Field id="address" label="Address" defaultValue={centre.address} />

            <div className="form-row">
              <Field id="phone" label="Phone" defaultValue={centre.phone} />
              <Field id="email" label="Email" type="email" defaultValue={centre.email} />
              <Field id="gstin" label="GSTIN" defaultValue={centre.gstin} />
            </div>

            <div className="form-row">
              <Field id="opening_time" label="Opening time" defaultValue={centre.opening_time} />
              <Field id="closing_time" label="Closing time" defaultValue={centre.closing_time} />
            </div>

            {canEdit && <div><SaveButton pending={pending} /></div>}
          </div>
        </fieldset>
      </SectionCard>
    </form>
  );
}

// ── My profile ──────────────────────────────────────────────
function ProfileForm({ profile }) {
  const [state, action, pending] = useActionState(updateOwnProfile, {});
  useActionFeedback(state);

  return (
    <form action={action}>
      <SectionCard title="My profile" subtitle="How you appear across the dashboard and audit log">
        <div className="flex flex-col gap-4">
          <Feedback state={state} />

          <div className="settings-identity">
            <Avatar name={profile?.full_name || profile?.email || '?'} size={44} />
            <div>
              <strong>{profile?.email}</strong>
              <span>
                <StatusBadge status={profile?.role === 'owner' ? 'approved' : 'active'} label={ROLE_LABELS[profile?.role] || 'Staff'} dot={false} />
              </span>
            </div>
          </div>

          <div className="form-row">
            <Field id="full_name" label="Full name" defaultValue={profile?.full_name} required />
            <Field id="phone" label="Phone" defaultValue={profile?.phone} />
          </div>

          <p className="form-hint">
            Your email and password are managed by Supabase Auth. To change your password, sign out and use
            &ldquo;Forgot password&rdquo;.
          </p>

          <div><SaveButton pending={pending} /></div>
        </div>
      </SectionCard>
    </form>
  );
}

// ── Business rules ──────────────────────────────────────────
function RulesForm({ centre }) {
  const [state, action, pending] = useActionState(updateBusinessRules, {});
  useActionFeedback(state);

  return (
    <form action={action}>
      <SectionCard title="Business rules" subtitle="These thresholds drive the flags across every screen">
        <div className="flex flex-col gap-4">
          <Feedback state={state} />

          <RuleField
            id="expiring_soon_days"
            label="Expiring soon"
            unit="days before expiry"
            defaultValue={centre.expiring_soon_days}
            description="A membership is flagged Expiring Soon this many days ahead, and appears on the renewals list."
          />
          <RuleField
            id="inactive_attendance_days"
            label="Idle seat warning"
            unit="days without attendance"
            defaultValue={centre.inactive_attendance_days}
            description="A seat holder who has not checked in for this long is flagged so you can review the seat."
          />
          <RuleField
            id="grace_period_days"
            label="Grace period"
            unit="days after expiry"
            defaultValue={centre.grace_period_days}
            description="How long a student keeps their seat after their membership lapses before being marked inactive."
          />

          <div className="callout callout-warning">
            <ShieldAlert size={15} className="callout-icon" />
            <div>
              Changing these re-flags existing records immediately. Nothing is deleted — a student who stops
              being &ldquo;expiring&rdquo; simply drops off the renewals list.
            </div>
          </div>

          <div><SaveButton pending={pending} /></div>
        </div>
      </SectionCard>
    </form>
  );
}

// ── Team ────────────────────────────────────────────────────
function TeamPanel({ team, meId }) {
  return (
    <SectionCard title="Team" subtitle={`${team.length} account${team.length === 1 ? '' : 's'} with dashboard access`} padded={false}>
      {team.length === 0 ? (
        <EmptyState compact icon={Users} title="No staff accounts yet" />
      ) : (
        <ul className="team-list">
          {team.map((member) => (
            <TeamRow key={member.id} member={member} isSelf={member.id === meId} />
          ))}
        </ul>
      )}

      <div className="card-footer">
        <p className="text-sm text-secondary">
          Signup is open — anyone with the link can create an account and lands on <strong>Front Desk</strong>.
          To lock this down later, turn off signups in Supabase → Authentication → Providers.
        </p>
      </div>
    </SectionCard>
  );
}

function TeamRow({ member, isSelf }) {
  const [state, action, pending] = useActionState(updateTeamMember, {});
  useActionFeedback(state);

  return (
    <li className="team-row">
      <Avatar name={member.full_name || member.email} size={34} />

      <div className="team-row-main">
        <span className="team-row-name">
          {member.full_name || member.email}
          {isSelf && <span className="team-row-you">you</span>}
        </span>
        <span className="team-row-email">{member.email}</span>
      </div>

      <form action={action} className="team-row-form">
        <input type="hidden" name="id" value={member.id} />
        <select name="role" className="form-select form-select-sm" defaultValue={member.role} aria-label={`Role for ${member.email}`}>
          <option value="owner">Owner</option>
          <option value="front_desk">Front Desk</option>
          <option value="facilities">Facilities</option>
        </select>
        <select name="is_active" className="form-select form-select-sm" defaultValue={String(member.is_active)} aria-label={`Status for ${member.email}`}>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
        <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
          {pending ? <Loader2 size={13} className="is-spinning" /> : 'Apply'}
        </button>
      </form>
    </li>
  );
}

// ── Plans & shifts (read-only here) ─────────────────────────
function Catalogue({ plans, slots }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Membership plans"
        subtitle={`${plans.length} configured`}
        actions={<Link href="/memberships/plans" className="btn btn-ghost btn-sm">Manage <ArrowRight size={13} /></Link>}
        padded={false}
      >
        {plans.length === 0 ? (
          <EmptyState compact icon={CreditCard} title="No plans yet" description="Run the schema file — it seeds seven standard plans." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Plan</th><th>Duration</th><th style={{ textAlign: 'right' }}>Price</th><th>Status</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-primary">{p.name}</td>
                    <td>{p.duration} {p.duration_unit}</td>
                    <td className="cell-num" style={{ textAlign: 'right' }}>₹{Number(p.price).toLocaleString('en-IN')}</td>
                    <td><StatusBadge status={p.is_active ? 'active' : 'inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Shifts"
        subtitle={`${slots.filter((s) => s.is_active).length} active`}
        actions={<Link href="/slots" className="btn btn-ghost btn-sm">Manage <ArrowRight size={13} /></Link>}
        padded={false}
      >
        {slots.length === 0 ? (
          <EmptyState compact icon={Clock} title="No shifts yet" description="Run the schema file — it seeds the standard shifts." />
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Shift</th><th>Timing</th><th style={{ textAlign: 'right' }}>Capacity</th><th>Status</th></tr></thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-primary">{s.name}</td>
                    <td>{s.start_time} – {s.end_time}</td>
                    <td className="cell-num" style={{ textAlign: 'right' }}>{s.capacity}</td>
                    <td><StatusBadge status={s.is_active ? 'active' : 'inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Small helpers ───────────────────────────────────────────
function Field({ id, label, defaultValue, type = 'text', required }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label} {required && <span className="required">*</span>}
      </label>
      <input id={id} name={id} type={type} className="form-input" defaultValue={defaultValue || ''} required={required} />
    </div>
  );
}

function RuleField({ id, label, unit, defaultValue, description }) {
  return (
    <div className="rule-field">
      <div className="rule-field-head">
        <label className="form-label" htmlFor={id}>{label}</label>
        <div className="rule-field-input">
          <input id={id} name={id} type="number" className="form-input" defaultValue={defaultValue} min={0} max={90} />
          <span className="rule-field-unit">{unit}</span>
        </div>
      </div>
      <p className="rule-field-desc">{description}</p>
    </div>
  );
}
