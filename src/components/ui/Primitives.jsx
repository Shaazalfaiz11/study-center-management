import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { statusLabel, statusTone } from '../../services/businessRules';

// ============================================================
// StatusBadge — one badge component for every status in the app
// ============================================================
export function StatusBadge({ status, label, tone, dot = true, size }) {
  const resolvedTone = tone || statusTone(status);
  const resolvedLabel = label || statusLabel(status);
  return (
    <span className={`badge badge-${resolvedTone} ${size === 'sm' ? 'badge-sm' : ''}`}>
      {dot && <span className="badge-dot" />}
      {resolvedLabel}
    </span>
  );
}

// ============================================================
// PageHeader
// ============================================================
export function PageHeader({ title, description, actions, meta }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h2 className="page-header-title">{title}</h2>
        {description && <p className="page-header-desc">{description}</p>}
        {meta && <div className="page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

// ============================================================
// SectionCard
// ============================================================
export function SectionCard({ title, subtitle, actions, children, padded = true, className = '', footer }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <div className="card-header-text">
            {title && <span className="card-title">{title}</span>}
            {subtitle && <span className="card-subtitle">{subtitle}</span>}
          </div>
          {actions && <div className="card-header-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'card-body' : ''}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

// ============================================================
// Modal
// ============================================================
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h3 className="modal-title">{title}</h3>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

// ============================================================
// Drawer — right-hand detail panel, full screen on mobile
// ============================================================
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 440 }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [open, title]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-header">
          <div className="drawer-header-text">
            <h3 className="drawer-title">{title}</h3>
            {subtitle && <span className="drawer-subtitle">{subtitle}</span>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body" ref={bodyRef}>
          {children}
        </div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </>,
    document.body,
  );
}

// ============================================================
// ConfirmDialog — rendered once by AppShell, driven by confirm()
// ============================================================
const TONE_ICONS = { danger: AlertTriangle, warning: AlertTriangle, success: CheckCircle2, default: Info };

export function ConfirmDialog({ state, onResolve }) {
  if (!state) return null;
  const Icon = TONE_ICONS[state.tone] || Info;

  return (
    <Modal
      open
      onClose={() => onResolve(false)}
      title={state.title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => onResolve(false)}>
            {state.cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${state.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onResolve(true)}
            autoFocus
          >
            {state.confirmLabel}
          </button>
        </>
      }
    >
      <div className={`confirm-body confirm-${state.tone}`}>
        <div className="confirm-icon">
          <Icon size={20} />
        </div>
        <div className="confirm-content">
          {state.message && <p className="confirm-message">{state.message}</p>}
          {state.details && <div className="confirm-details">{state.details}</div>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Small building blocks
// ============================================================
export function DetailRow({ label, value, strong }) {
  return (
    <div className="detail-row">
      <span className="detail-row-label">{label}</span>
      <span className={`detail-row-value ${strong ? 'detail-row-strong' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

export function DetailGrid({ items }) {
  return (
    <dl className="detail-grid">
      {items.map((item) => (
        <div key={item.label} className="detail-grid-item">
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, size = 32 }) {
  const initials = String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading" />;
}

/** Button that shows a spinner and disables itself while pending. */
export function ActionButton({ pending, children, className = 'btn btn-primary', disabled, ...rest }) {
  return (
    <button type="button" className={className} disabled={pending || disabled} {...rest}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ProgressBar({ value, tone }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const resolved = tone || (pct >= 90 ? 'error' : pct >= 75 ? 'warning' : 'primary');
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill progress-${resolved}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
