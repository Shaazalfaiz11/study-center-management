import { Building2 } from 'lucide-react';

/**
 * Auth shell.
 *
 * This used to read the centre name from the database to brand the sign-in
 * screen. Under multi-tenancy that is no longer possible or meaningful: the
 * visitor is anonymous, so RLS correctly returns nothing, and there is no
 * single centre to name — the sign-in page is shared by every tenant.
 *
 * Per-tenant branding would need a subdomain or an invitation link to
 * identify the organization before authentication. Product branding until
 * then.
 */
export default async function AuthLayout({ children }) {
  const centre = null;

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="auth-logo">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="auth-title">{centre?.name || 'Self Study Center'}</h1>
            <p className="auth-subtitle">{centre?.branch || 'Admin dashboard'}</p>
          </div>
        </div>

        {children}
      </div>

      <aside className="auth-aside">
        <h2>Run the whole centre from one screen</h2>
        <ul className="auth-points">
          <li>See who is in, who owes money and which seats are free — live</li>
          <li>Handle shift changes and seat transfers without losing history</li>
          <li>Pause a membership for leave and give the days back on return</li>
          <li>Open one daily report that answers every owner question</li>
        </ul>
      </aside>
    </div>
  );
}
