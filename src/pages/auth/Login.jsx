import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Primitives';
import { CENTER } from '../../data/mockData';
import './Login.css';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('rajesh@vidyastudycenter.in');
  const [password, setPassword] = useState('demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Enter both an email address and a password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-logo">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="login-title">{CENTER.name}</h1>
            <p className="login-subtitle">{CENTER.branch} · Admin dashboard</p>
          </div>
        </div>

        <form onSubmit={submit} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studycenter.in"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="login-password">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button type="button" className="login-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? <Spinner /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="login-hint">Demo credentials are pre-filled — select Sign in to continue.</p>
        </form>
      </div>

      <aside className="login-aside">
        <h2>Run the whole centre from one screen</h2>
        <ul className="login-points">
          <li>See who is in, who owes money and which seats are free — live</li>
          <li>Handle shift changes and seat transfers without losing history</li>
          <li>Pause a membership for leave and give the days back on return</li>
          <li>Open one daily report that answers every owner question</li>
        </ul>
        <p className="login-note">Demonstration build with sample data. No live student records are used.</p>
      </aside>
    </div>
  );
}
