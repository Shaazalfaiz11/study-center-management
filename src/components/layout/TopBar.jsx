'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { Avatar } from '@/components/ui/Primitives';
import { ROLE_LABELS } from './Sidebar';
import './TopBar.css';

export default function TopBar({ title, description, account, onMenuClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open navigation">
          <Menu size={19} />
        </button>
        <div className="topbar-heading">
          <h1 className="topbar-title">{title}</h1>
          {description && <span className="topbar-description">{description}</span>}
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-dropdown-wrap" ref={ref}>
          <button className="topbar-profile-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <Avatar name={account?.name || 'Staff'} size={28} />
            <div className="topbar-profile-info">
              <span className="topbar-profile-name">{account?.name}</span>
              <span className="topbar-profile-role">{ROLE_LABELS[account?.role] || 'Staff'}</span>
            </div>
            <ChevronDown size={14} className="text-muted" />
          </button>

          {open && (
            <div className="topbar-dropdown topbar-profile-dropdown">
              <div className="topbar-profile-summary">
                <span className="topbar-profile-name">{account?.name}</span>
                <span className="topbar-profile-email">{account?.email}</span>
              </div>

              <Link href="/settings" className="topbar-dropdown-item" onClick={() => setOpen(false)}>
                <User size={15} /> Profile &amp; Settings
              </Link>

              <div className="topbar-dropdown-divider" />

              {/* A server action, so the session cookie is cleared server-side. */}
              <form action={signOut}>
                <button type="submit" className="topbar-dropdown-item is-danger" style={{ width: '100%' }}>
                  <LogOut size={15} /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
