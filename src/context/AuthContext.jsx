import { createContext, useContext, useState, useCallback } from 'react';
import { STAFF } from '../data/mockData';

const AuthContext = createContext(null);
const STORAGE_KEY = 'ssc_admin_user';

/**
 * Demo authentication. There is no auth server — sign-in resolves
 * against the staff list in the mock data.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(
    (email, password) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!email || !password) {
            reject(new Error('Enter both an email address and a password'));
            return;
          }
          const match = STAFF.find((s) => s.email?.toLowerCase() === String(email).toLowerCase());
          const account = {
            id: match?.id || 'staff-1',
            name: match?.name || 'Rajesh Kumar',
            email: match?.email || email,
            role: match?.role || 'Owner',
            center: 'Hazratganj Branch',
          };
          setUser(account);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
          } catch {
            /* storage unavailable — session-only sign-in */
          }
          resolve(account);
        }, 600);
      }),
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return <AuthContext.Provider value={{ user, login, logout, isAuthenticated: Boolean(user) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
