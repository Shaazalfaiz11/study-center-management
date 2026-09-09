'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from './StateViews';

/**
 * KPI tile with an optional breakdown strip.
 *
 * The breakdown is the point: a headline number alone makes an owner
 * click through to find out *what* it is made of. Splitting it into
 * two or three sub-values answers the obvious follow-up in place.
 *
 * `tone` tints the card and the icon; the sub-tiles stay on white so
 * the numbers keep their contrast.
 */
export default function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  breakdown = [],
  progress = null,
  trend,
  onClick,
  loading,
}) {
  if (loading) {
    return (
      <div className="stat-tile stat-tile-neutral">
        <Skeleton width="40%" height={11} />
        <Skeleton width="60%" height={26} style={{ marginTop: 10 }} />
        <Skeleton width="100%" height={30} style={{ marginTop: 12 }} />
      </div>
    );
  }

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      className={`stat-tile stat-tile-${tone} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="stat-tile-head">
        <span className="stat-tile-label">{label}</span>
        {Icon && (
          <span className="stat-tile-icon">
            <Icon size={16} />
          </span>
        )}
      </div>

      <div className="stat-tile-value-row">
        <span className="stat-tile-value">{value}</span>
        {trend && (
          <span className={`stat-tile-trend ${trend.direction === 'down' ? 'is-down' : 'is-up'}`}>
            {trend.direction === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {trend.label}
          </span>
        )}
      </div>

      {hint && <span className="stat-tile-hint">{hint}</span>}

      {progress !== null && (
        <div className="stat-tile-progress">
          <span className="stat-tile-progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}

      {breakdown.length > 0 && (
        <div className="stat-tile-breakdown" style={{ gridTemplateColumns: `repeat(${breakdown.length}, minmax(0, 1fr))` }}>
          {breakdown.map((item) => (
            <div key={item.label} className="stat-tile-chip">
              <span className="stat-tile-chip-label">{item.label}</span>
              <span className={`stat-tile-chip-value ${item.tone ? `text-${item.tone}` : ''}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Wrapper>
  );
}