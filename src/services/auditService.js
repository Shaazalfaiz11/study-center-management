// ============================================================
// AUDIT SERVICE
// Every important admin action writes one entry here.
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { todayISO } from './businessRules';

let currentActor = 'Rajesh Kumar';

export const setActor = (name) => { if (name) currentActor = name; };
export const getActor = () => currentActor;

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

/**
 * Append an audit entry to a draft. Called from inside other
 * services' `mutate` blocks so the action and its audit trail
 * are written together.
 */
export const appendAudit = (draft, { action, entity, summary, before = '—', after = '—', admin }) => {
  const date = todayISO();
  const time = nowTime();
  const entry = {
    id: nextId('audit'),
    action,
    entity,
    summary,
    before,
    after,
    admin: admin || currentActor,
    date,
    time,
    dateTime: `${date} ${time}`,
  };
  draft.auditLog = [entry, ...draft.auditLog];
  return entry;
};

export const auditService = {
  getAuditLog: (filters = {}) =>
    respond(() => {
      let rows = [...getState().auditLog];
      if (filters.action && filters.action !== 'all') rows = rows.filter((r) => r.action === filters.action);
      if (filters.admin && filters.admin !== 'all') rows = rows.filter((r) => r.admin === filters.admin);
      if (filters.from) rows = rows.filter((r) => r.date >= filters.from);
      if (filters.to) rows = rows.filter((r) => r.date <= filters.to);
      return rows;
    }),

  getRecentActivity: (limit = 8) => respond(() => getState().auditLog.slice(0, limit)),

  getEntityActivity: (entityName) =>
    respond(() => getState().auditLog.filter((r) => r.entity === entityName)),

  record: (payload) => respond(() => mutate((draft) => appendAudit(draft, payload)).auditLog[0]),
};

export default auditService;
