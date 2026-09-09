'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from './StateViews';

/**
 * KPI tile. Value first, label second, everything else optional —
 * the density an owner scanning numbers actually wants.
 */
export default function StatCard({ icon: Icon, label, value, sublabel, tone = 'neutral', trend, onClick, loading, emphasis }) {
  const Wrapper = onClick ? 'button' : 'div';

  if (loading) {
    return (
      <div className="stat-card">
        <Skeleton width="45%" height={11} />
        <Skeleton width="65%" height={24} style={{ marginTop: 10 }} />
      </div>
    );
  }

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      className={`stat-card stat-${tone} ${onClick ? 'is-clickable' : ''} ${emphasis ? 'stat-emphasis' : ''}`}
      onClick={onClick}
    >
      <div className="stat-card-head">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <span className="stat-card-icon">
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-foot">
        {sublabel && <span className="stat-card-sub">{sublabel}</span>}
        {trend && (
          <span className={`stat-trend ${trend.direction === 'down' ? 'is-down' : 'is-up'}`}>
            {trend.direction === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {trend.label}
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export function StatGrid({ children, columns }) {
  return (
    <div className="stat-grid" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {children}
    </div>
  );
}