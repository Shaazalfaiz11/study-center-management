import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, X, User, Armchair, Receipt, BadgeCheck, Repeat, FileText } from 'lucide-react';
import { globalSearch } from '../../services/searchService';
import { StatusBadge } from '../ui/Primitives';

const GROUP_ICONS = {
  students: User,
  seats: Armchair,
  payments: Receipt,
  memberships: BadgeCheck,
  'shift-changes': Repeat,
  invoices: FileText,
};

const QUICK_LINKS = [
  { label: 'Fee Collection', to: '/billing/collection' },
  { label: 'Shift Changes', to: '/assignments/shift-changes' },
  { label: 'Live Seat Map', to: '/seats/map' },
  { label: 'Leave Management', to: '/memberships/leave' },
  { label: 'Daily Operations Report', to: '/reports/daily' },
];

/**
 * Ctrl+K command palette. Searches students, seats, payments,
 * memberships, invoices and shift changes in one place.
 */
export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  const results = useMemo(() => globalSearch(query), [query]);

  // Flatten for keyboard navigation.
  const flat = useMemo(() => results.groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))), [results]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // Focus after the portal paints.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const go = (to) => {
    onClose();
    navigate(to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter' && flat[cursor]) {
      e.preventDefault();
      go(flat[cursor].to);
    }
  };

  let runningIndex = -1;

  return createPortal(
    <div className="search-overlay" onMouseDown={onClose}>
      <div className="search-palette" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-palette-input">
          <Search size={17} className="search-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search students, seats, payments, memberships…"
            aria-label="Search"
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close search">
            <X size={16} />
          </button>
        </div>

        <div className="search-palette-body" ref={listRef}>
          {!query.trim() ? (
            <div className="search-group">
              <span className="search-group-label">Jump to</span>
              {QUICK_LINKS.map((link) => (
                <button key={link.to} type="button" className="search-item" onClick={() => go(link.to)}>
                  <span className="search-item-title">{link.label}</span>
                </button>
              ))}
            </div>
          ) : results.total === 0 ? (
            <div className="search-empty">
              <span className="search-empty-title">No matches for “{query}”</span>
              <span className="search-empty-text">Try a student name, seat number like A-24, or a receipt number.</span>
            </div>
          ) : (
            results.groups.map((group) => {
              const Icon = GROUP_ICONS[group.key] || Search;
              return (
                <div key={group.key} className="search-group">
                  <span className="search-group-label">{group.label}</span>
                  {group.items.map((item) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-active={index === cursor}
                        className={`search-item ${index === cursor ? 'is-active' : ''}`}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => go(item.to)}
                      >
                        <span className="search-item-icon">
                          <Icon size={15} />
                        </span>
                        <span className="search-item-text">
                          <span className="search-item-title">{item.title}</span>
                          <span className="search-item-sub">{item.subtitle}</span>
                        </span>
                        {item.meta && <StatusBadge status={item.tone} label={item.meta} dot={false} />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="search-palette-footer">
          <span className="search-hint">
            <kbd>
              <ArrowUp size={10} />
            </kbd>
            <kbd>
              <ArrowDown size={10} />
            </kbd>
            navigate
          </span>
          <span className="search-hint">
            <kbd>
              <CornerDownLeft size={10} />
            </kbd>
            open
          </span>
          <span className="search-hint">
            <kbd>Esc</kbd> close
          </span>
          {results.total > 0 && <span className="search-hint ml-auto">{results.total} results</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
