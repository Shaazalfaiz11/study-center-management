import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, Building2, Clock, Armchair, BadgeCheck, Bell, CreditCard, Banknote,
  Users, Settings as SettingsIcon, ArrowRight, SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SectionCard, ActionButton, StatusBadge } from '../../components/ui/Primitives';
import { EXPIRING_SOON_DAYS, INACTIVE_ATTENDANCE_DAYS, GRACE_PERIOD_DAYS } from '../../services/businessRules';
import './Settings.css';

const TABS = [
  { key: 'center', label: 'Centre info', icon: Building2 },
  { key: 'rules', label: 'Business rules', icon: SlidersHorizontal },
  { key: 'reminders', label: 'Reminders', icon: Bell },
  { key: 'payment', label: 'Payment methods', icon: CreditCard },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'shortcuts', label: 'Shortcuts', icon: SettingsIcon },
];

const LINKS = [
  { label: 'Shifts', icon: Clock, to: '/slots', description: 'Timings and capacity for each shift' },
  { label: 'Seats', icon: Armchair, to: '/seats/desks', description: 'Add, edit and block seats' },
  { label: 'Membership plans', icon: BadgeCheck, to: '/memberships/plans', description: 'Pricing and duration' },
  { label: 'Expenses', icon: Banknote, to: '/billing/expenses', description: 'Categories and running costs' },
];

export default function SettingsPage() {
  const { addToast, center, staff, paymentMethods } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('center');
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState({ ...center });

  const save = async () => {
    setPending(true);
    // Settings are display-only in this build — the save confirms the flow.
    await new Promise((r) => setTimeout(r, 400));
    setPending(false);
    addToast('Settings saved', 'success');
  };

  const set = (key, value) => setInfo((i) => ({ ...i, [key]: value }));

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`settings-nav-item ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {tab === 'center' && (
          <SectionCard title="Centre information" subtitle="Shown on receipts and invoices">
            <div className="flex flex-col gap-4">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="st-name">Centre name</label>
                  <input id="st-name" className="form-input" value={info.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="st-branch">Branch</label>
                  <input id="st-branch" className="form-input" value={info.branch} onChange={(e) => set('branch', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="st-address">Address</label>
                <input id="st-address" className="form-input" value={info.address} onChange={(e) => set('address', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="st-phone">Phone</label>
                  <input id="st-phone" className="form-input" value={info.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="st-email">Email</label>
                  <input id="st-email" className="form-input" value={info.email} onChange={(e) => set('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="st-gstin">GSTIN</label>
                  <input id="st-gstin" className="form-input" value={info.gstin} onChange={(e) => set('gstin', e.target.value)} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="st-open">Opening time</label>
                  <input id="st-open" className="form-input" value={info.openingTime} onChange={(e) => set('openingTime', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="st-close">Closing time</label>
                  <input id="st-close" className="form-input" value={info.closingTime} onChange={(e) => set('closingTime', e.target.value)} />
                </div>
              </div>

              <ActionButton pending={pending} onClick={save} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                <Save size={14} /> Save changes
              </ActionButton>
            </div>
          </SectionCard>
        )}

        {tab === 'rules' && (
          <SectionCard title="Business rules" subtitle="How the system decides what needs attention">
            <div className="rules-list">
              <RuleRow
                label="Expiring soon"
                value={`${EXPIRING_SOON_DAYS} days`}
                description="Memberships are flagged as Expiring Soon this many days before the expiry date."
              />
              <RuleRow
                label="Overdue"
                value="Due date passed"
                description="A payment becomes Overdue the day after its due date while a balance remains."
              />
              <RuleRow
                label="Potentially inactive seat"
                value={`${INACTIVE_ATTENDANCE_DAYS} days`}
                description="A seat holder with no attendance for this long is flagged so the seat can be reviewed."
              />
              <RuleRow
                label="Grace period"
                value={`${GRACE_PERIOD_DAYS} days`}
                description="Students keep their seat for this long after expiry before being marked inactive."
              />
              <RuleRow
                label="Shift change capacity"
                value="Blocked when full"
                description="A shift change cannot be approved if the requested shift has no free seat or is at capacity."
              />
              <RuleRow
                label="Leave and expiry"
                value="Days preserved"
                description="Paused days are added back to the expiry date when the membership resumes."
              />
              <RuleRow
                label="Temporary release"
                value="Assignment kept"
                description="A seat freed by leave keeps its original holder and returns to them automatically."
              />
            </div>
          </SectionCard>
        )}

        {tab === 'reminders' && (
          <SectionCard title="Reminder schedule" subtitle="When students are prompted about renewals and dues">
            <div className="flex flex-col gap-3">
              {['7 days before expiry', '3 days before expiry', '1 day before expiry', 'On the expiry day', '3 days after expiry'].map((r, i) => (
                <label key={r} className="form-checkbox">
                  <input type="checkbox" defaultChecked={i < 4} />
                  <span>{r}</span>
                </label>
              ))}
              <div className="callout callout-info">
                <Bell size={15} className="callout-icon" />
                <div>Reminders are queued for the front desk to send. No messages leave this application.</div>
              </div>
              <ActionButton pending={pending} onClick={save} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                <Save size={14} /> Save
              </ActionButton>
            </div>
          </SectionCard>
        )}

        {tab === 'payment' && (
          <SectionCard title="Payment methods" subtitle="Methods offered when recording a payment">
            <div className="flex flex-col gap-3">
              {paymentMethods.concat(['Cheque', 'Other']).map((m) => (
                <label key={m} className="form-checkbox">
                  <input type="checkbox" defaultChecked={paymentMethods.includes(m)} />
                  <span>{m}</span>
                </label>
              ))}
              <ActionButton pending={pending} onClick={save} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                <Save size={14} /> Save
              </ActionButton>
            </div>
          </SectionCard>
        )}

        {tab === 'team' && (
          <SectionCard title="Team" subtitle="Who can access this dashboard" padded={false}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-primary">{s.name}</td>
                      <td><span className="badge badge-gray">{s.role}</span></td>
                      <td>{s.email || <span className="text-muted">—</span>}</td>
                      <td><StatusBadge status="active" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {tab === 'shortcuts' && (
          <SectionCard title="Manage elsewhere" subtitle="These are configured on their own screens">
            <div className="settings-links">
              {LINKS.map((link) => (
                <button key={link.to} type="button" className="settings-link" onClick={() => navigate(link.to)}>
                  <span className="settings-link-icon">
                    <link.icon size={16} />
                  </span>
                  <span className="settings-link-body">
                    <strong>{link.label}</strong>
                    <span>{link.description}</span>
                  </span>
                  <ArrowRight size={15} className="text-muted" />
                </button>
              ))}
            </div>

            <div className="settings-shortcuts">
              <span className="uppercase-label">Keyboard</span>
              <div className="shortcut-row">
                <span>Global search</span>
                <span><kbd>Ctrl</kbd> <kbd>K</kbd></span>
              </div>
              <div className="shortcut-row">
                <span>Close a dialog</span>
                <span><kbd>Esc</kbd></span>
              </div>
              <div className="shortcut-row">
                <span>Move through search results</span>
                <span><kbd>↑</kbd> <kbd>↓</kbd></span>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function RuleRow({ label, value, description }) {
  return (
    <div className="rule-row">
      <div className="rule-row-head">
        <span className="rule-row-label">{label}</span>
        <span className="badge badge-info">{value}</span>
      </div>
      <p className="rule-row-desc">{description}</p>
    </div>
  );
}
