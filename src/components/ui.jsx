import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Pagination from 'react-bootstrap/Pagination';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';

/* ------------------------------------------------------------------ constants */

export const STAGES = [
  ['foundation', 'Foundation'],
  ['diploma', 'Diploma'],
  ['bsc_degree', 'BSc degree'],
  ['bs_degree', 'BS degree'],
];

export const LEVELS = [
  ['beginner', 'Beginner'],
  ['intermediate', 'Intermediate'],
  ['advanced', 'Advanced'],
  ['expert', 'Expert'],
];

export const LEVEL_LABEL = Object.fromEntries(LEVELS);
export const STAGE_LABEL = Object.fromEntries(STAGES);

export const ROLE_LABEL = { student: 'Student', mentor: 'Mentor', admin: 'Administrator' };

/* ------------------------------------------------------------------ formatting */

const pad = (n) => String(n).padStart(2, '0');

export const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

export const fmtDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : '—');

export const fmtTime = (iso) => (iso
  ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  : '—');

export const fmtDay = (iso) => (iso
  ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  : '—');

export function timeAgo(iso) {
  if (!iso) return '—';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(iso);
}

export function untilText(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${Math.max(1, hours)} h left`;
  const days = Math.ceil(ms / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : 0);

export const toDateInput = (value) => {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toTimeInput = (value) => {
  const d = value ? new Date(value) : new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function combineLocal(date, time) {
  if (!date || !time) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0).toISOString();
}

export const initials = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join('') || '?';

/* ------------------------------------------------------------------ data hook */

/**
 * Run an async fetcher and track loading/error. `deps` controls re-fetching, like useEffect.
 * The fetcher is read through a ref so inline closures do not cause loops.
 */
export function useApi(fetcher, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: undefined, loading: immediate, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setState((current) => ({ ...current, loading: true, error: null }));
    }
    try {
      const data = await fetcherRef.current();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, immediate]);

  return { ...state, reload: load };
}

/* ------------------------------------------------------------------ primitives */

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap align-items-start">{actions}</div>}
    </div>
  );
}

const STATUS_META = {
  pending: ['status-pending', 'Pending'],
  pending_review: ['status-pending_review', 'Pending review'],
  accepted: ['status-accepted', 'Accepted'],
  approved: ['status-approved', 'Approved'],
  active: ['status-active', 'Active'],
  completed: ['status-completed', 'Completed'],
  scheduled: ['status-scheduled', 'Scheduled'],
  declined: ['status-declined', 'Declined'],
  rejected: ['status-rejected', 'Rejected'],
  cancelled: ['status-cancelled', 'Cancelled'],
  expired: ['status-expired', 'Expired'],
  ended: ['status-ended', 'Ended'],
  suspended: ['status-suspended', 'Suspended'],
  draft: ['status-draft', 'Draft'],
  open: ['status-open', 'Open'],
  booked: ['status-booked', 'Booked'],
  blocked: ['status-blocked', 'Blocked'],
};

export function StatusBadge({ status, label }) {
  if (!status) return null;
  const [className, text] = STATUS_META[status] || ['status-draft', status.replaceAll('_', ' ')];
  return <span className={`status-badge ${className}`}>{label || text}</span>;
}

export function StatCard({ label, value, hint, to, onClick, children }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
      {children}
    </>
  );
  if (to) return <Link to={to} className="stat-card">{body}</Link>;
  return <div className="stat-card" onClick={onClick} role={onClick ? 'button' : undefined}>{body}</div>;
}

export function EmptyState({ icon = '◎', title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h5>{title}</h5>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 3, height = 16 }) {
  return (
    <div className="d-grid gap-2" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton" style={{ height, width: `${100 - index * 7}%` }} />
      ))}
    </div>
  );
}

export function Loading({ label = 'Loading…', rows = 3 }) {
  return (
    <div>
      <div className="small text-muted mb-2">{label}</div>
      <SkeletonRows rows={rows} />
    </div>
  );
}

export function ApiErrorBanner({ error, onRetry, compact = false }) {
  if (!error) return null;
  return (
    <Alert variant="danger" className={compact ? 'py-2 mb-2' : 'py-2'}>
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <div>
          <span className="fw-semibold">{error.code || 'Error'}</span>
          <span className="mx-1">—</span>
          <span>{error.message}</span>
          {error.requestId && (
            <div className="small mt-1 opacity-75">
              Reference: <code>{error.requestId}</code>
            </div>
          )}
        </div>
        {onRetry && (
          <Button size="sm" variant="outline-danger" onClick={() => onRetry()} className="align-self-start">
            Retry
          </Button>
        )}
      </div>
    </Alert>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="py-3">
      <ApiErrorBanner error={error} onRetry={onRetry} />
    </div>
  );
}

export function Busy({ label }) {
  return (
    <span className="d-inline-flex align-items-center gap-2 text-muted small">
      <Spinner animation="border" size="sm" role="status" />
      {label}
    </span>
  );
}

export function FullPageSpinner() {
  return (
    <div className="spinner-page">
      <Spinner animation="border" variant="secondary" role="status">
        <span className="visually-hidden">Loading…</span>
      </Spinner>
    </div>
  );
}

export function Chip({ children, selected, onClick, title, onRemove }) {
  const interactive = Boolean(onClick);
  return (
    <span
      className={`chip ${interactive ? 'chip-selectable' : ''} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => { if (event.key === 'Enter' || event.key === ' ') onClick(); } : undefined}
      title={title}
    >
      {children}
      {onRemove && (
        <button type="button" aria-label="Remove" onClick={(event) => { event.stopPropagation(); onRemove(); }}>×</button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ layout bits */

export function Tabs({ tabs, active, onChange }) {
  return (
    <ul className="nav nav-tabs mb-3">
      {tabs.map((tab) => (
        <li className="nav-item" key={tab.key}>
          <button
            type="button"
            className={`nav-link ${active === tab.key ? 'active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`badge ms-2 ${active === tab.key ? 'text-bg-secondary' : 'text-bg-light text-dark'}`}>
                {tab.count}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`card-soft ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2 className="section-title mb-0">{title}</h2>}
            {subtitle && <div className="small text-muted mt-1">{subtitle}</div>}
          </div>
          {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName || 'card-body'}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ lists */
export function Pager({ meta, onPage, onPageSize, pageSizes = [10, 20, 50] }) {
  if (!meta) return null;
  const total = meta.total ?? 0;
  const page = meta.page ?? 1;
  const pageSize = meta.page_size ?? 10;
  const pages = Math.max(1, meta.total_pages ?? 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const numbers = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let n = start; n <= end; n += 1) numbers.push(n);

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
      <div className="text-muted small">
        Showing {from}–{to} of {total}
      </div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        {onPageSize && (
          <Form.Select
            size="sm"
            style={{ width: 110 }}
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {pageSizes.map((size) => <option key={size} value={size}>{size} / page</option>)}
          </Form.Select>
        )}
        <Pagination size="sm" className="mb-0">
          <Pagination.Prev disabled={page <= 1} onClick={() => onPage(page - 1)} />
          {start > 1 && <Pagination.Item onClick={() => onPage(1)}>1</Pagination.Item>}
          {start > 2 && <Pagination.Ellipsis disabled />}
          {numbers.map((n) => (
            <Pagination.Item key={n} active={n === page} onClick={() => onPage(n)}>{n}</Pagination.Item>
          ))}
          {end < pages - 1 && <Pagination.Ellipsis disabled />}
          {end < pages && <Pagination.Item onClick={() => onPage(pages)}>{pages}</Pagination.Item>}
          <Pagination.Next disabled={page >= pages} onClick={() => onPage(page + 1)} />
        </Pagination>
      </div>
    </div>
  );
}

export function DataTable({ columns, rows, rowKey, empty, onRowClick, mobileTitle }) {
  if (!rows || rows.length === 0) {
    return empty || <EmptyState title="Nothing to show yet" />;
  }
  const keyOf = rowKey || ((row) => row.id || row.session_id || row.request_id || row.mentorship_id);
  const titleOf = mobileTitle || ((row) => (columns[0].render ? columns[0].render(row) : row[columns[0].key]));

  return (
    <>
      <div className="table-responsive d-none d-md-block">
        <table className="table table-hover align-middle mb-0">
          <thead>
            <tr>
              {columns.map((col) => <th key={col.key} className={col.className}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                className={onRowClick ? 'clickable' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-md-none">
        {rows.map((row) => (
          <div
            key={keyOf(row)}
            className={`mobile-row ${onRowClick ? 'clickable' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="fw-semibold text-navy mb-2">{titleOf(row)}</div>
            {columns.slice(1).map((col) => (
              <div key={col.key} className="d-flex justify-content-between gap-3 py-1 small">
                <span className="text-muted">{col.label}</span>
                <span className="text-end">{col.render ? col.render(row) : row[col.key] ?? '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ ratings */

export function Stars({ value = 0, count, showValue = true }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span aria-hidden="true" className="text-warning" style={{ letterSpacing: '0.05em' }}>
        {'★'.repeat(Math.max(0, rounded))}{'☆'.repeat(Math.max(0, 5 - rounded))}
      </span>
      {showValue && <span className="fw-semibold small">{Number(value).toFixed(1)}</span>}
      {count != null && <span className="text-muted small">({count})</span>}
    </span>
  );
}

export function RatingInput({ value, onChange, name = 'rating' }) {
  return (
    <div className="d-flex align-items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className={`rating-star ${star <= value ? 'on' : ''}`}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
      <input type="hidden" name={name} value={value} readOnly />
      <span className="ms-2 small text-muted">{value ? `${value} / 5` : 'Select a rating'}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

/** Map ApiError.details onto react-hook-form fields. */
export function applyFieldErrors(error, setError, fields = []) {
  let matched = false;
  (error?.details || []).forEach((detail) => {
    const root = String(detail.field || '').split('.')[0].replace(/\[\d+\]/g, '');
    const target = fields.find((name) => name === root || name.endsWith(`.${root}`))
      || fields.find((name) => name.startsWith(`${root}.`))
      || (fields.includes(root) ? root : null);
    if (target) {
      setError(target, { type: 'server', message: detail.issue });
      matched = true;
    }
  });
  return matched;
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · IITM Mentoring` : 'IITM Mentoring Platform';
  }, [title]);
}
