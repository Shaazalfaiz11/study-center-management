'use client';

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/** Skeleton block — used everywhere loading placeholders are needed. */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : width} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <div className="skeleton-table" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skeleton-table-row">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} width={c === 0 ? '70%' : c === columns - 1 ? '40%' : '85%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, height = 84 }) {
  return (
    <div className="skeleton-cards">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius={12} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'empty-state-compact' : ''}`}>
      <div className="empty-state-icon">
        <Icon size={compact ? 18 : 22} />
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-text">{description}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, compact = false }) {
  return (
    <div className={`error-state ${compact ? 'error-state-compact' : ''}`} role="alert">
      <div className="error-state-icon">
        <AlertTriangle size={compact ? 18 : 22} />
      </div>
      <div className="error-state-title">{title}</div>
      {description && <div className="error-state-text">{description}</div>}
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

/**
 * The standard loading / error / empty ladder. Screens wrap their
 * content in this so all three states look the same everywhere.
 */
export function AsyncBoundary({ loading, error, empty, onRetry, skeleton, emptyState, children }) {
  if (loading) return skeleton || <SkeletonTable />;
  if (error) return <ErrorState description={error.message} onRetry={onRetry} />;
  if (empty) return emptyState || <EmptyState title="Nothing to show" />;
  return children;
}