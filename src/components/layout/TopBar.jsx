import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, LogOut, User, ChevronRight, Check, Command } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/operationsService';
import { Avatar } from '../ui/Primitives';
import { formatDateLong, todayISO } from '../../services/businessRules';
import GlobalSearch from './GlobalSearch';
import './TopBar.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '');

export default function TopBar({ title, description, onMenuClick }) {
  const { user, logout } = useAuth();
  const { notifications, addToast } = useApp();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl/Cmd + K opens global search from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openNotification = async (notification) => {
    if (!notification.read) await notificationService.markRead({ id: notification.id });
    setShowNotifs(false);
    if (notification.link) navigate(notification.link);
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    addToast('All notifications marked as read', 'success');
  };

  return (
    <>
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
          <span className="topbar-date">{formatDateLong(todayISO())}</span>

          <button className="topbar-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search (Ctrl+K)">
            <Search size={15} />
            <span className="topbar-search-label">Search…</span>
            <kbd className="topbar-kbd">{isMac ? <Command size={10} /> : 'Ctrl'}K</kbd>
          </button>

          <button className="topbar-icon-btn topbar-search-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search size={18} />
          </button>

          <div className="topbar-dropdown-wrap" ref={notifRef}>
            <button
              className="topbar-icon-btn"
              onClick={() => {
                setShowNotifs((v) => !v);
                setShowProfile(false);
              }}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="topbar-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {showNotifs && (
              <div className="topbar-dropdown topbar-notif-dropdown">
                <div className="topbar-dropdown-header">
                  <span className="font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
                      <Check size={13} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="topbar-notif-list">
                  {notifications.slice(0, 6).map((n) => (
                    <button key={n.id} className={`topbar-notif-item ${n.read ? '' : 'unread'}`} onClick={() => openNotification(n)}>
                      <span className="topbar-notif-title">{n.title}</span>
                      <span className="topbar-notif-msg">{n.message}</span>
                      <span className="topbar-notif-time">{n.time}</span>
                    </button>
                  ))}
                  {notifications.length === 0 && <div className="topbar-notif-empty">You&rsquo;re all caught up.</div>}
                </div>
                <div className="topbar-dropdown-footer">
                  <button
                    className="btn btn-ghost btn-sm w-full"
                    onClick={() => {
                      navigate('/notifications');
                      setShowNotifs(false);
                    }}
                  >
                    See all notifications <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="topbar-dropdown-wrap" ref={profileRef}>
            <button
              className="topbar-profile-btn"
              onClick={() => {
                setShowProfile((v) => !v);
                setShowNotifs(false);
              }}
            >
              <Avatar name={user?.name || 'Admin'} size={28} />
              <div className="topbar-profile-info">
                <span className="topbar-profile-name">{user?.name || 'Admin'}</span>
                <span className="topbar-profile-role">{user?.role || 'Administrator'}</span>
              </div>
            </button>
            {showProfile && (
              <div className="topbar-dropdown topbar-profile-dropdown">
                <div className="topbar-profile-summary">
                  <span className="topbar-profile-name">{user?.name}</span>
                  <span className="topbar-profile-email">{user?.email}</span>
                </div>
                <button
                  className="topbar-dropdown-item"
                  onClick={() => {
                    navigate('/settings');
                    setShowProfile(false);
                  }}
                >
                  <User size={15} /> Profile &amp; Settings
                </button>
                <div className="topbar-dropdown-divider" />
                <button className="topbar-dropdown-item is-danger" onClick={handleLogout}>
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
