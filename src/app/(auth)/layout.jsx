import { Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth shell. The centre name comes from the database when it is
 * reachable, so a rebranded centre shows its own name on the sign-in
 * screen — but a settings row that does not exist yet must never block
 * anyone from signing in, hence the fallback.
 */
async function getCentre() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('centre_settings').select('name, branch').eq('id', 1).single();
    return data || null;
  } catch {
    return null;
  }
}

export default async function AuthLayout({ children }) {
  const centre = await getCentre();

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
