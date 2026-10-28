import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadCsv, getAll, get, patch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/toast.jsx';
import {
  ApiErrorBanner, Chip, DataTable, EmptyState, ErrorState, Loading, PageHeader, Pager, Panel,
  ROLE_LABEL, StatusBadge, Tabs, StatCard, useApi, useTitle, daysSince, fmtDate,
  fmtDateTime, fmtTime, timeAgo, toDateInput, initials,
} from '../components/ui.jsx';
import {
  CatalogueDialog, ConfirmDialog, ReasonDialog, RequestDrawer,
} from '../components/dialogs.jsx';

/* ------------------------------------------------------------------ shared */

function presetRange(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: toDateInput(from), to: toDateInput(to) };
}

function DateRangeBar({ range, setRange, onApply, busy, extra }) {
  const invalid = !range.from || !range.to || range.from > range.to;
  const apply = (next) => {
    if (!next.from || !next.to || next.from > next.to) return;
    onApply(next);
  };
  return (
    <Form
      className="d-flex flex-wrap gap-2 align-items-end"
      onSubmit={(event) => { event.preventDefault(); apply(range); }}
    >
      <div>
        <Form.Label className="small mb-1">From</Form.Label>
        <Form.Control
          size="sm" type="date" value={range.from} max={range.to || undefined}
          onChange={(event) => setRange({ ...range, from: event.target.value })}
        />
      </div>
      <div>
        <Form.Label className="small mb-1">To</Form.Label>
        <Form.Control
          size="sm" type="date" value={range.to} min={range.from || undefined}
          onChange={(event) => setRange({ ...range, to: event.target.value })}
        />
      </div>
      <div className="d-flex gap-1 pb-1">
        <Button size="sm" variant="outline-secondary" type="button" onClick={() => { const next = presetRange(30); setRange(next); apply(next); }}>
          Last 30 days
        </Button>
        <Button size="sm" variant="outline-secondary" type="button" onClick={() => { const next = presetRange(90); setRange(next); apply(next); }}>
          Last 90 days
        </Button>
      </div>
      <Button size="sm" variant="primary" type="submit" disabled={busy || invalid}>
        {busy && <Spinner animation="border" size="sm" className="me-2" />}
        Apply range
      </Button>
      {invalid && <span className="small text-danger pb-2">The end date must be on or after the start date.</span>}
      {extra}
    </Form>
  );
}

const shortPeriod = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function TrendBars({ series, color = 'rgba(42, 127, 142, 0.72)', emptyLabel = 'No activity in this period', valueLabel = 'Value' }) {
  const points = series || [];
  const total = points.reduce((sum, point) => sum + (Number(point.value) || 0), 0);
  if (points.length === 0 || total === 0) {
    return <div className="py-4 text-center text-muted small">{emptyLabel}</div>;
  }
  const max = Math.max(1, ...points.map((point) => Number(point.value) || 0));
  return (
    <>
      <div className="bar-chart">
        {points.map((point) => {
          const value = Number(point.value) || 0;
          return (
            <div
              className="bar-col"
              key={point.period_start}
              title={`${shortPeriod(point.period_start)} · ${valueLabel}: ${point.value == null ? '—' : point.value}`}
            >
              <div
                className="bar-fill"
                style={{ height: `${Math.max(2, (value / max) * 100)}%`, backgroundColor: color }}
              />
              <div className="bar-label">{shortPeriod(point.period_start)}</div>
            </div>
          );
        })}
      </div>
      <div className="small text-muted mt-2">Peak: {max} · Total: {total}</div>
    </>
  );
}

/** Groups smaller than five are shown as '<5' (privacy rule on page 26). */
const suppress = (count) => (Number(count) > 0 && Number(count) < 5 ? '<5' : String(Number(count) || 0));

function Funnel({ steps }) {
  const max = Math.max(1, ...steps.map((step) => step.value || 0));
  return (
    <div>
      {steps.map((step) => (
        <div className="funnel-row" key={step.label}>
          <div className="funnel-label">{step.label}</div>
          <div className="funnel-track">
            <div className="funnel-bar" style={{ width: `${Math.max(1, ((step.value || 0) / max) * 100)}%` }} />
          </div>
          <div className="funnel-value">{step.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

const CHECKLIST = [
  ['background', 'Background and affiliation verified'],
  ['details', 'Title, organisation, experience and bio complete'],
  ['policy', 'No policy or conduct concerns'],
];

/* ================================================================== page 22 */

export function AdminDashboard() {
  useTitle('Admin dashboard');
  const [range, setRange] = useState(() => presetRange(30));
  const [applied, setApplied] = useState(range);

  const overview = useApi(
    () => get('/admin/analytics/overview', { from: applied.from, to: applied.to }),
    [applied.from, applied.to],
  );
  const requestsTrend = useApi(
    () => get('/admin/analytics/trends', {
      metric: 'requests', interval: 'week', from: applied.from, to: applied.to,
    }),
    [applied.from, applied.to],
  );
  const sessionsTrend = useApi(
    () => get('/admin/analytics/trends', {
      metric: 'sessions', interval: 'week', from: applied.from, to: applied.to,
    }),
    [applied.from, applied.to],
  );
  const pending = useApi(() => get('/admin/mentors', { profile_status: 'pending_review', page_size: 5 }), []);
  const stale = useApi(
    () => get('/admin/mentoring-requests', { status: 'pending', older_than_days: 10, page_size: 5 }),
    [],
  );
  const audit = useApi(() => get('/admin/audit-logs', { page_size: 8 }), []);

  const data = overview.data?.data;
  const pendingRows = pending.data?.data || [];
  const staleRows = stale.data?.data || [];

  const requestSeries = requestsTrend.data?.data?.series || [];
  const sessionSeries = sessionsTrend.data?.data?.series || [];

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Programme health and the work queue for your team."
        actions={(
          <>
            <Link to="/admin/mentors" className="btn btn-outline-primary">Review applications</Link>
            <Link to="/admin/analytics" className="btn btn-primary">Open analytics</Link>
          </>
        )}
      />

      <Panel className="mb-3" title="Reporting period" subtitle="Applies to the KPI cards and the trend charts.">
        <DateRangeBar range={range} setRange={setRange} onApply={setApplied} busy={overview.loading} />
      </Panel>

      {overview.error && <ApiErrorBanner error={overview.error} onRetry={overview.reload} />}

      <Row className="g-3 mb-3">
        <Col sm={6} xl={3}>
          <StatCard
            label="Pending mentor reviews"
            value={pending.loading ? '—' : pending.data?.meta?.total ?? 0}
            to="/admin/mentors"
            hint="Applications awaiting a decision"
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Active mentorships"
            value={overview.loading ? '—' : data?.mentorships?.active ?? 0}
            to="/admin/mentorships"
            hint="Started in the selected period"
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Requests in period"
            value={overview.loading ? '—' : data?.requests?.total ?? 0}
            hint={data ? `${Math.round((data.requests.acceptance_rate || 0) * 100)}% accepted` : '—'}
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Average rating"
            value={overview.loading ? '—' : (data?.feedback?.average_rating != null ? data.feedback.average_rating.toFixed(2) : '—')}
            hint={data ? `${data.feedback.count} ratings in period` : '—'}
          />
        </Col>
      </Row>

      <Row className="g-3">
        <Col xl={8}>
          <Panel
            title="Requests and sessions"
            subtitle={`Weekly activity from ${applied.from} to ${applied.to}.`}
            actions={<Link to="/admin/analytics" className="btn btn-sm btn-outline-primary">Open analytics</Link>}
          >
            <Row className="g-4">
              <Col md={6}>
                <div className="small-label mb-2">Requests received</div>
                {requestsTrend.loading && <Loading label="Loading trend…" rows={2} />}
                {requestsTrend.error && <ErrorState error={requestsTrend.error} onRetry={requestsTrend.reload} />}
                {!requestsTrend.loading && !requestsTrend.error && (
                  <TrendBars series={requestSeries} valueLabel="Requests" />
                )}
              </Col>
              <Col md={6}>
                <div className="small-label mb-2">Sessions created</div>
                {sessionsTrend.loading && <Loading label="Loading trend…" rows={2} />}
                {sessionsTrend.error && <ErrorState error={sessionsTrend.error} onRetry={sessionsTrend.reload} />}
                {!sessionsTrend.loading && !sessionsTrend.error && (
                  <TrendBars series={sessionSeries} color="rgba(31, 58, 95, 0.72)" valueLabel="Sessions" />
                )}
              </Col>
            </Row>
          </Panel>

          <Panel
            title="Stale requests"
            subtitle="Pending for more than 10 days. Follow up with the mentor."
            className="mt-3"
            actions={<Link to="/admin/mentorships?tab=requests" className="btn btn-sm btn-outline-primary">View stale requests</Link>}
          >
            {stale.loading && <Loading label="Loading stale requests…" rows={2} />}
            {stale.error && <ErrorState error={stale.error} onRetry={stale.reload} />}
            {!stale.loading && !stale.error && staleRows.length === 0 && (
              <EmptyState icon="✓" title="No stale requests">
                Every pending request is less than ten days old.
              </EmptyState>
            )}
            {staleRows.length > 0 && (
              <div className="list-tight">
                {staleRows.map((row) => (
                  <div key={row.request_id} className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                    <div>
                      <div className="fw-semibold">{row.student_name} → {row.mentor_name}</div>
                      <div className="small text-muted text-truncate" style={{ maxWidth: '52ch' }}>{row.career_goal}</div>
                      <div className="small text-muted">Sent {fmtDate(row.created_at)} · {daysSince(row.created_at)} days ago</div>
                    </div>
                    <span className="status-badge status-pending">{daysSince(row.created_at)} days</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Col>

        <Col xl={4}>
          <Panel
            title="Review queue"
            subtitle="Oldest applications first."
            actions={<Link to="/admin/mentors" className="btn btn-sm btn-outline-primary">Open queue</Link>}
          >
            {pending.loading && <Loading label="Loading queue…" rows={3} />}
            {pending.error && <ErrorState error={pending.error} onRetry={pending.reload} />}
            {!pending.loading && !pending.error && pendingRows.length === 0 && (
              <EmptyState icon="✓" title="Queue is empty">
                No mentor applications are waiting for review.
              </EmptyState>
            )}
            <div className="list-tight">
              {pendingRows.map((row) => (
                <div key={row.mentor_id} className="d-flex gap-2 align-items-start">
                  <div className="avatar-sm" style={{ background: '#e2eef5', color: '#1F3A5F' }}>{initials(row.full_name)}</div>
                  <div className="min-w-0">
                    <div className="fw-semibold">{row.full_name}</div>
                    <div className="small text-muted text-truncate">
                      {row.professional_title || 'Mentor applicant'}
                      {row.organisation ? ` · ${row.organisation}` : ''}
                    </div>
                    <div className="small text-muted">Applied {fmtDate(row.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Recent activity"
            subtitle="Latest audit entries."
            className="mt-3"
          >
            {audit.loading && <Loading label="Loading audit trail…" rows={4} />}
            {audit.error && <ErrorState error={audit.error} onRetry={audit.reload} />}
            {!audit.loading && !audit.error && (audit.data?.data || []).length === 0 && (
              <EmptyState icon="◔" title="No activity yet" />
            )}
            <div className="list-tight">
              {(audit.data?.data || []).map((entry) => (
                <div key={entry.audit_id}>
                  <div className="small fw-semibold">{entry.action.replaceAll('.', ' · ')}</div>
                  <div className="small text-muted">
                    {entry.entity_type} · {timeAgo(entry.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== page 23 */

function UsersPanel() {
  const toast = useToast();
  const { user } = useAuth();
  const [filters, setFilters] = useState({ role: '', account_status: '', q: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [target, setTarget] = useState(null);

  const users = useApi(
    () => get('/admin/users', {
      page,
      page_size: pageSize,
      role: applied.role || undefined,
      account_status: applied.account_status || undefined,
      q: applied.q.trim() || undefined,
    }),
    [page, pageSize, applied],
  );

  const rows = users.data?.data || [];
  const meta = users.data?.meta;

  const applyFilters = (event) => {
    event.preventDefault();
    setApplied({ ...filters });
    setPage(1);
  };

  const clearFilters = () => {
    const blank = { role: '', account_status: '', q: '' };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  };

  const changeStatus = async ({ choice, reason }) => {
    await patch(`/admin/users/${target.user_id}/status`, {
      account_status: choice,
      reason: reason || null,
    });
    toast.success(`${target.full_name} is now ${choice}.`);
    users.reload({ silent: true });
  };

  const statusOptions = target?.account_status === 'active'
    ? [
      { value: 'suspended', label: 'Suspend — block sign-in but keep the account' },
      { value: 'deactivated', label: 'Deactivate — close the account' },
    ]
    : [{ value: 'active', label: 'Reactivate — restore full access' }];

  return (
    <>
      <Panel className="mb-3">
        <Form onSubmit={applyFilters}>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label>Name or e-mail</Form.Label>
              <Form.Control
                size="sm" value={filters.q} placeholder="Search users…"
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              />
            </Col>
            <Col sm={6} md={3}>
              <Form.Label>Role</Form.Label>
              <Form.Select
                size="sm" value={filters.role}
                onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="">Any role</option>
                <option value="student">Student</option>
                <option value="mentor">Mentor</option>
                <option value="admin">Administrator</option>
              </Form.Select>
            </Col>
            <Col sm={6} md={3}>
              <Form.Label>Account status</Form.Label>
              <Form.Select
                size="sm" value={filters.account_status}
                onChange={(event) => setFilters((current) => ({ ...current, account_status: event.target.value }))}
              >
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
              </Form.Select>
            </Col>
            <Col md={2} className="d-flex gap-2">
              <Button size="sm" type="submit" variant="primary">Apply</Button>
              <Button size="sm" type="button" variant="outline-secondary" onClick={clearFilters}>Clear</Button>
            </Col>
          </Row>
        </Form>
      </Panel>

      {users.error && <ErrorState error={users.error} onRetry={users.reload} />}
      {users.loading && <Loading label="Loading users…" rows={5} />}

      {!users.loading && !users.error && (
        <>
          <Panel bodyClassName="p-0">
            <DataTable
              rows={rows}
              rowKey={(row) => row.user_id}
              empty={(
                <EmptyState icon="◌" title="No users match the filters">
                  Try a different search or clear the filters.
                </EmptyState>
              )}
              columns={[
                {
                  key: 'name',
                  label: 'User',
                  render: (row) => (
                    <div className="d-flex gap-2 align-items-center">
                      <div className="avatar-sm" style={{ background: '#e2eef5', color: '#1F3A5F' }}>{initials(row.full_name)}</div>
                      <div>
                        <div className="fw-semibold">{row.full_name}</div>
                        <div className="small text-muted">{row.email}</div>
                      </div>
                    </div>
                  ),
                },
                { key: 'role', label: 'Role', render: (row) => ROLE_LABEL[row.role] || row.role },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.account_status} /> },
                {
                  key: 'last_login',
                  label: 'Last login',
                  render: (row) => <span className="small text-muted">{row.last_login_at ? timeAgo(row.last_login_at) : 'Never'}</span>,
                },
                {
                  key: 'created',
                  label: 'Joined',
                  render: (row) => <span className="small text-muted">{fmtDate(row.created_at)}</span>,
                },
                {
                  key: 'actions',
                  label: '',
                  className: 'text-end',
                  render: (row) => (
                    row.user_id === user?.user_id ? (
                      <Button size="sm" variant="outline-secondary" disabled title="Administrators cannot change their own status">
                        Your account
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline-primary" onClick={() => setTarget(row)}>
                        {row.account_status === 'active' ? 'Suspend / deactivate' : 'Reactivate'}
                      </Button>
                    )
                  ),
                },
              ]}
              mobileTitle={(row) => row.full_name}
            />
          </Panel>
          <Pager meta={meta} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      <ReasonDialog
        show={Boolean(target)}
        onHide={() => setTarget(null)}
        title={target ? `Change status for ${target.full_name}` : 'Change account status'}
        prompt="Suspending or deactivating signs the user out everywhere and cancels their pending requests. The reason is shared with the account holder."
        choice={{ label: 'New status', defaultValue: statusOptions[0]?.value, options: statusOptions }}
        confirmLabel="Update account"
        confirmVariant={statusOptions[0]?.value === 'active' ? 'primary' : 'danger'}
        required={statusOptions[0]?.value !== 'active'}
        onSubmit={changeStatus}
      />
    </>
  );
}

function CataloguePanel() {
  const toast = useToast();
  const [kind, setKind] = useState('skill');
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [dialog, setDialog] = useState(null); // { item } | { item: null }
  const [retireTarget, setRetireTarget] = useState(null);

  const list = useApi(
    () => get(kind === 'skill' ? '/skills' : '/career-interests', {
      page,
      page_size: 10,
      include_inactive: includeInactive,
      with_usage: true,
      ...(kind === 'skill' ? { q: appliedQuery.trim() || undefined } : {}),
    }),
    [kind, page, includeInactive, appliedQuery],
  );

  const rows = list.data?.data || [];
  const meta = list.data?.meta;

  const switchKind = (next) => {
    setKind(next);
    setPage(1);
    setQuery('');
    setAppliedQuery('');
  };

  const openAdd = () => setDialog({ item: null });

  const quickToggle = async () => {
    const isSkill = kind === 'skill';
    const path = isSkill ? `/admin/skills/${retireTarget.skill_id}` : `/admin/career-interests/${retireTarget.interest_id}`;
    const nextActive = retireTarget.is_active === false;
    await patch(path, { is_active: nextActive });
    toast.success(nextActive ? 'Entry reactivated.' : 'Entry retired.');
    list.reload({ silent: true });
  };

  const afterSave = () => {
    toast.success('Catalogue updated.');
    list.reload({ silent: true });
  };

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-end justify-content-between mb-3">
        <Tabs
          active={kind}
          onChange={switchKind}
          tabs={[
            { key: 'skill', label: 'Skills' },
            { key: 'interest', label: 'Career interests' },
          ]}
        />
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={openAdd}>
            Add {kind === 'skill' ? 'skill' : 'interest'}
          </Button>
        </div>
      </div>

      <Panel className="mb-3">
        <div className="d-flex flex-wrap gap-3 align-items-end">
          {kind === 'skill' && (
            <Form
              className="d-flex gap-2 align-items-end"
              onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query); setPage(1); }}
            >
              <div>
                <Form.Label className="small mb-1">Search skills</Form.Label>
                <Form.Control
                  size="sm" value={query} placeholder="e.g. Python"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button size="sm" type="submit" variant="primary">Search</Button>
              {appliedQuery && (
                <Button size="sm" type="button" variant="outline-secondary" onClick={() => { setQuery(''); setAppliedQuery(''); setPage(1); }}>
                  Clear
                </Button>
              )}
            </Form>
          )}
          <Form.Check
            type="switch"
            id="include-retired"
            className="ms-md-auto"
            label="Show retired entries"
            checked={includeInactive}
            onChange={(event) => { setIncludeInactive(event.target.checked); setPage(1); }}
          />
        </div>
      </Panel>

      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.loading && <Loading label="Loading the catalogue…" rows={5} />}

      {!list.loading && !list.error && (
        <>
          <Panel bodyClassName="p-0">
            <DataTable
              rows={rows}
              rowKey={(row) => row.skill_id || row.interest_id}
              empty={(
                <EmptyState
                  icon="◌"
                  title={kind === 'skill' ? 'No skills found' : 'No career interests found'}
                  action={<Button size="sm" variant="primary" onClick={openAdd}>Add the first {kind === 'skill' ? 'skill' : 'interest'}</Button>}
                >
                  {appliedQuery ? 'Try a different search.' : 'The catalogue is empty.'}
                </EmptyState>
              )}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (row) => (
                    <div>
                      <div className="fw-semibold">{row.skill_name || row.interest_name}</div>
                      <div className="small text-muted">
                        {row.category || row.description || '—'}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'usage',
                  label: 'Used by',
                  render: (row) => (
                    <span className="small">
                      {row.usage_count ?? 0} profile{(row.usage_count ?? 0) === 1 ? '' : 's'}
                    </span>
                  ),
                },
                {
                  key: 'active',
                  label: 'State',
                  render: (row) => (
                    row.is_active === false
                      ? <span className="status-badge status-cancelled">Retired</span>
                      : <span className="status-badge status-active">Active</span>
                  ),
                },
                {
                  key: 'actions',
                  label: '',
                  className: 'text-end',
                  render: (row) => (
                    <div className="d-flex gap-1 justify-content-end">
                      <Button size="sm" variant="outline-secondary" onClick={() => setDialog({ item: row })}>Edit</Button>
                      <Button
                        size="sm"
                        variant={row.is_active === false ? 'outline-success' : 'outline-danger'}
                        onClick={() => setRetireTarget(row)}
                      >
                        {row.is_active === false ? 'Reactivate' : 'Retire'}
                      </Button>
                    </div>
                  ),
                },
              ]}
              mobileTitle={(row) => row.skill_name || row.interest_name}
            />
          </Panel>
          <Pager meta={meta} onPage={setPage} />
        </>
      )}

      <CatalogueDialog
        show={Boolean(dialog)}
        onHide={() => setDialog(null)}
        kind={kind}
        item={dialog?.item || null}
        onSaved={afterSave}
      />

      <ConfirmDialog
        show={Boolean(retireTarget)}
        onHide={() => setRetireTarget(null)}
        title={retireTarget?.is_active === false ? 'Reactivate this entry?' : 'Retire this entry?'}
        confirmLabel={retireTarget?.is_active === false ? 'Reactivate' : 'Retire'}
        variant={retireTarget?.is_active === false ? 'primary' : 'danger'}
        onConfirm={quickToggle}
      >
        <div className="note-box small">
          <strong>{retireTarget?.skill_name || retireTarget?.interest_name}</strong>
          <div className="mt-1 text-muted">
            {retireTarget?.is_active === false
              ? 'It will be selectable on profiles again.'
              : 'Existing profiles keep this entry; it can no longer be selected by anyone new.'}
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}

export function AdminUsers() {
  useTitle('User management');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'catalogue' ? 'catalogue' : 'users';
  const setTab = (next) => setParams(next === 'catalogue' ? { tab: 'catalogue' } : {}, { replace: true });

  return (
    <>
      <PageHeader
        title="User management"
        subtitle="Accounts, account status and the skill and career-interest catalogues."
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'users', label: 'Users' },
          { key: 'catalogue', label: 'Catalogue' },
        ]}
      />
      {tab === 'users' ? <UsersPanel /> : <CataloguePanel />}
    </>
  );
}

/* ================================================================== page 24 */

const MENTOR_TABS = [
  { key: 'pending_review', label: 'Pending review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

export function AdminMentors() {
  useTitle('Mentor review');
  const toast = useToast();
  const [tab, setTab] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checks, setChecks] = useState({ background: false, details: false, policy: false });
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  const list = useApi(
    () => get('/admin/mentors', {
      profile_status: tab,
      page,
      page_size: 10,
      q: appliedQuery.trim() || undefined,
    }),
    [tab, page, appliedQuery, refreshKey],
  );

  const counts = useApi(async () => {
    const pairs = await Promise.all(MENTOR_TABS.map((entry) => get('/admin/mentors', {
      profile_status: entry.key, page_size: 1,
    }).then((envelope) => [entry.key, envelope.meta?.total ?? 0])));
    return Object.fromEntries(pairs);
  }, [refreshKey]);

  const rows = list.data?.data || [];
  const meta = list.data?.meta;
  const selected = rows.find((row) => row.mentor_id === selectedId) || rows[0] || null;

  useEffect(() => {
    setChecks({ background: false, details: false, policy: false });
  }, [selected?.mentor_id]);

  const noteFromChecks = () => CHECKLIST.filter(([key]) => checks[key]).map(([, label]) => label).join('; ');

  const switchTab = (next) => {
    setTab(next);
    setPage(1);
    setSelectedId(null);
    setAppliedQuery('');
    setQuery('');
  };

  const decide = async (decision, note) => {
    const mentorId = selected?.mentor_id;
    if (!mentorId) return;
    try {
      await patch(`/admin/mentors/${mentorId}/approval`, { decision, note: note || null });
      toast.success(
        decision === 'approve' ? `${selected.full_name} is approved.`
          : decision === 'reject' ? 'Application rejected; a local demo notification was added.'
            : 'Mentor profile suspended.',
      );
      setSelectedId(null);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      if (err.code === 'INVALID_STATE_TRANSITION') {
        toast.error('That application was already decided. The list has been refreshed.');
        setRefreshKey((value) => value + 1);
      }
      throw err;
    }
  };

  const approve = () => decide('approve', noteFromChecks());

  const reject = async ({ reason }) => {
    if (!reason.trim()) throw new Error('A note is required when rejecting an application.');
    return decide('reject', [reason.trim(), noteFromChecks()].filter(Boolean).join(' — '));
  };

  const suspend = ({ reason }) => decide('suspend', [reason.trim(), noteFromChecks()].filter(Boolean).join(' — '));

  const checkedCount = CHECKLIST.filter(([key]) => checks[key]).length;
  const canApprove = selected && ['pending_review', 'rejected', 'suspended'].includes(selected.profile_status);
  const canReject = selected?.profile_status === 'pending_review';
  const canSuspend = selected && ['approved', 'pending_review'].includes(selected.profile_status);

  return (
    <>
      <PageHeader
        title="Mentor review"
        subtitle="Verify applications and decide who joins the directory. Every decision is audit-logged."
      />

      <Tabs
        active={tab}
        onChange={switchTab}
        tabs={MENTOR_TABS.map((entry) => ({ ...entry, count: counts.data?.[entry.key] ?? 0 }))}
      />

      <Panel className="mb-3">
        <Form
          className="d-flex flex-wrap gap-2 align-items-end"
          onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query); setPage(1); }}
        >
          <div className="flex-grow-1" style={{ maxWidth: 420 }}>
            <Form.Label className="small mb-1">Search applications</Form.Label>
            <Form.Control
              size="sm" value={query} placeholder="Name, organisation or title"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Button size="sm" type="submit" variant="primary">Search</Button>
          {appliedQuery && (
            <Button size="sm" type="button" variant="outline-secondary" onClick={() => { setQuery(''); setAppliedQuery(''); setPage(1); }}>
              Clear
            </Button>
          )}
        </Form>
      </Panel>

      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.loading && <Loading label="Loading applications…" rows={4} />}

      {!list.loading && !list.error && (
        <>
          <Panel bodyClassName="p-0">
            <DataTable
              rows={rows}
              rowKey={(row) => row.mentor_id}
              onRowClick={(row) => setSelectedId(row.mentor_id)}
              empty={(
                <EmptyState icon="✓" title={tab === 'pending_review' ? 'No applications waiting' : 'Nothing in this tab'}>
                  {tab === 'pending_review' ? 'Every mentor application has been reviewed.' : 'Applications appear here after a decision.'}
                </EmptyState>
              )}
              columns={[
                {
                  key: 'name',
                  label: 'Applicant',
                  render: (row) => (
                    <div>
                      <div className="fw-semibold">{row.full_name}</div>
                      <div className="small text-muted">{row.email}</div>
                    </div>
                  ),
                },
                {
                  key: 'organisation',
                  label: 'Organisation',
                  render: (row) => (
                    <div>
                      <div className="small">{row.organisation || '—'}</div>
                      <div className="small text-muted">{row.professional_title || 'Title not set'}</div>
                    </div>
                  ),
                },
                {
                  key: 'type',
                  label: 'Type',
                  render: (row) => (
                    <span className="small text-capitalize">{row.mentor_type.replace('_', ' ')}</span>
                  ),
                },
                {
                  key: 'submitted',
                  label: 'Submitted / updated',
                  render: (row) => (
                    <div className="small text-muted">
                      <div>{row.created_at ? fmtDate(row.created_at) : '—'}</div>
                      <div>Updated {row.updated_at ? timeAgo(row.updated_at) : '—'}</div>
                    </div>
                  ),
                },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.profile_status} /> },
              ]}
              mobileTitle={(row) => row.full_name}
            />
          </Panel>
          <Pager meta={meta} onPage={setPage} />
        </>
      )}

      {selected && (
        <Panel
          className="mt-3"
          title={selected.full_name}
          subtitle={`${selected.professional_title || 'Mentor applicant'}${selected.organisation ? ` · ${selected.organisation}` : ''}`}
          actions={(
            <>
              <StatusBadge status={selected.profile_status} />
              {canApprove && <Button size="sm" variant="success" onClick={() => setApproveOpen(true)}>Approve</Button>}
              {canReject && <Button size="sm" variant="outline-danger" onClick={() => setRejectOpen(true)}>Reject</Button>}
              {canSuspend && <Button size="sm" variant="outline-warning" onClick={() => setSuspendOpen(true)}>Suspend</Button>}
            </>
          )}
        >
          <Row className="g-3">
            <Col lg={7}>
              <Row className="g-2 small">
                <Col sm={6}><div className="small-label">E-mail</div><div>{selected.email}</div></Col>
                <Col sm={6}><div className="small-label">Mentor type</div><div className="text-capitalize">{selected.mentor_type.replace('_', ' ')}</div></Col>
                <Col sm={6}><div className="small-label">Experience</div><div>{selected.experience_years != null ? `${selected.experience_years} years` : 'Not stated'}</div></Col>
                <Col sm={6}><div className="small-label">Graduation year</div><div>{selected.graduation_year || 'Not stated'}</div></Col>
                <Col sm={6}><div className="small-label">Capacity</div><div>{selected.max_active_mentees} mentees</div></Col>
                <Col sm={6}><div className="small-label">Accepting requests</div><div>{selected.is_available ? 'Yes' : 'Paused'}</div></Col>
                <Col sm={6}><div className="small-label">Rating</div><div>{selected.rating ? `${selected.rating.average.toFixed(1)} / 5 (${selected.rating.count})` : 'No ratings yet'}</div></Col>
                <Col sm={6}>
                  <div className="small-label">LinkedIn</div>
                  {selected.linkedin_url
                    ? <a aria-disabled="true" title="Presentation only: external profiles are disabled in this demo.">Open profile (demo only)</a>
                    : <div className="text-muted">Not provided</div>}
                </Col>
              </Row>

              <div className="small-label mt-3">Bio</div>
              <p className="small mb-3">{selected.bio || 'No bio provided.'}</p>

              <div className="small-label">Expertise</div>
              <div className="mt-1 mb-3">
                {(selected.expertise || []).map((skill) => (
                  <Chip key={skill.skill_id}>{skill.skill_name} · {skill.expertise_level}</Chip>
                ))}
                {(selected.expertise || []).length === 0 && <span className="small text-muted">None listed.</span>}
              </div>

              <div className="small-label">Career pathways</div>
              <div className="mt-1">
                {(selected.interests || []).map((interest) => <Chip key={interest.interest_id}>{interest.interest_name}</Chip>)}
                {(selected.interests || []).length === 0 && <span className="small text-muted">None listed.</span>}
              </div>

              {(selected.review_note || selected.reviewed_at) && (
                <div className="review-note mt-3">
                  <div className="small-label mb-1">Previous decision</div>
                  <div className="small">
                    {selected.reviewed_at ? `Reviewed ${fmtDate(selected.reviewed_at)}. ` : ''}
                    {selected.review_note || 'No note recorded.'}
                  </div>
                </div>
              )}
            </Col>

            <Col lg={5}>
              <div className="note-box">
                <div className="fw-semibold mb-2">Verification checklist</div>
                {CHECKLIST.map(([key, label]) => (
                  <Form.Check
                    key={key}
                    type="checkbox"
                    id={`check-${key}`}
                    className="small mb-2"
                    label={label}
                    checked={checks[key]}
                    onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                ))}
                <div className="small text-muted mt-2">
                  {checkedCount} of {CHECKLIST.length} checks complete. Checked items are recorded in the decision note.
                </div>
              </div>

              <div className="policy-note mt-3">
                Approving publishes the profile in search. Rejecting requires a note that is shown to the mentor.
                Suspending cancels any pending requests addressed to this mentor.
              </div>
            </Col>
          </Row>
        </Panel>
      )}

      <ConfirmDialog
        show={approveOpen}
        onHide={() => setApproveOpen(false)}
        title="Approve this mentor?"
        confirmLabel="Approve application"
        variant="success"
        onConfirm={approve}
      >
        <div className="note-box small">
          <div><strong>{selected?.full_name}</strong> will appear in mentor search and can receive requests.</div>
          <div className="text-muted mt-2">
            Checklist: {checkedCount} of {CHECKLIST.length} complete
            {noteFromChecks() ? ` (${noteFromChecks()})` : ''}.
          </div>
        </div>
      </ConfirmDialog>

      <ReasonDialog
        show={rejectOpen}
        onHide={() => setRejectOpen(false)}
        title="Reject this application"
        prompt="The mentor sees this note on their profile and can address it before applying again."
        confirmLabel="Reject application"
        required
        onSubmit={reject}
        reasons={['Profile details are incomplete', 'Expertise does not match the directory', 'Verification could not be completed']}
      />

      <ReasonDialog
        show={suspendOpen}
        onHide={() => setSuspendOpen(false)}
        title="Suspend this mentor"
        prompt="Suspension hides the profile from students and cancels pending requests. A note is optional."
        confirmLabel="Suspend mentor"
        onSubmit={suspend}
        reasons={['Capacity or availability concerns', 'Policy concern under review', 'Requested by the mentor']}
      />
    </>
  );
}

/* ================================================================== page 25 */

function MentorshipDrawer({ show, mentorshipId, onHide, onChanged }) {
  const toast = useToast();
  const [endOpen, setEndOpen] = useState(false);

  const bundle = useApi(async () => {
    const [detail, sessions] = await Promise.all([
      get(`/mentorships/${mentorshipId}`),
      getAll(`/mentorships/${mentorshipId}/sessions`),
    ]);
    return { detail: detail.data, sessions };
  }, [mentorshipId], { immediate: false });

  useEffect(() => {
    if (show && mentorshipId) bundle.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, mentorshipId]);

  const detail = bundle.data?.detail;
  const sessions = (bundle.data?.sessions || [])
    .slice()
    .sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start));

  const endMentorship = async ({ choice, reason }) => {
    if (choice === 'ended' && !reason.trim()) throw new Error('A reason is required when ending a mentorship early.');
    await patch(`/mentorships/${mentorshipId}`, { status: choice, reason: reason || null });
    toast.success(choice === 'completed' ? 'Mentorship marked completed.' : 'Mentorship ended.');
    bundle.reload({ silent: true });
    onChanged?.();
  };

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: 'min(620px, 100vw)' }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Mentorship details</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {bundle.loading && <Loading label="Loading mentorship…" rows={5} />}
        {bundle.error && <ErrorState error={bundle.error} onRetry={bundle.reload} />}
        {detail && (
          <>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="fw-semibold">{detail.student_name} → {detail.mentor_name}</div>
                <div className="small text-muted">Started {fmtDate(detail.started_at)}</div>
              </div>
              <StatusBadge status={detail.status} />
            </div>

            <div className="small-label">Career goal</div>
            <p className="mt-1">{detail.career_goal || '—'}</p>

            <div className="note-box mb-3">
              <div className="d-flex justify-content-between"><span className="text-muted">Sessions completed</span><span>{detail.sessions_completed}</span></div>
              <div className="d-flex justify-content-between"><span className="text-muted">Sessions scheduled</span><span>{detail.sessions_scheduled}</span></div>
              <div className="d-flex justify-content-between"><span className="text-muted">Last session</span><span>{detail.last_session_at ? fmtDateTime(detail.last_session_at) : '—'}</span></div>
              {detail.ended_at && (
                <div className="d-flex justify-content-between"><span className="text-muted">Ended</span><span>{fmtDate(detail.ended_at)}</span></div>
              )}
            </div>

            {detail.end_reason && (
              <div className="review-note mb-3">
                <div className="small-label mb-1">Closure note</div>
                {detail.end_reason}
              </div>
            )}

            <h6 className="section-title mb-2">Sessions</h6>
            {sessions.length === 0 && <p className="small text-muted">No sessions have been booked.</p>}
            <div className="list-tight">
              {sessions.map((session) => (
                <div key={session.session_id} className="py-2 border-bottom">
                  <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                    <div>
                      <div className="fw-semibold small">{fmtDateTime(session.scheduled_start)}</div>
                      <div className="small text-muted text-capitalize">
                        {session.meeting_mode.replace('_', ' ')} · ends {fmtTime(session.scheduled_end)}
                      </div>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                  {session.notes && <div className="small text-muted mt-1">{session.notes}</div>}
                </div>
              ))}
            </div>

            {detail.status === 'active' && (
              <div className="d-flex justify-content-end mt-4">
                <Button variant="outline-danger" onClick={() => setEndOpen(true)}>End mentorship</Button>
              </div>
            )}
          </>
        )}
      </Offcanvas.Body>

      <ReasonDialog
        show={endOpen}
        onHide={() => setEndOpen(false)}
        title="Close this mentorship"
        prompt="Future sample sessions are cancelled; demo notifications stay in this browser."
        choice={{
          label: 'How should it close?',
          defaultValue: 'ended',
          options: [
            { value: 'completed', label: 'Completed — goals were met' },
            { value: 'ended', label: 'Ended early — reason required' },
          ],
        }}
        confirmLabel="Close mentorship"
        onSubmit={endMentorship}
      />
    </Offcanvas>
  );
}

function MentorshipsPanel() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const list = useApi(
    () => get('/admin/mentorships', { status: status || undefined, page, page_size: 10 }),
    [status, page],
  );

  const rows = list.data?.data || [];

  const open = (row) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    list.reload({ silent: true });
  };

  return (
    <>
      <Panel className="mb-3">
        <Form className="d-flex flex-wrap gap-2 align-items-end" onSubmit={(event) => event.preventDefault()}>
          <div style={{ minWidth: 190 }}>
            <Form.Label className="small mb-1">Status</Form.Label>
            <Form.Select
              size="sm" value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="ended">Ended</option>
            </Form.Select>
          </div>
        </Form>
      </Panel>

      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.loading && <Loading label="Loading mentorships…" rows={5} />}

      {!list.loading && !list.error && (
        <>
          <Panel bodyClassName="p-0">
            <DataTable
              rows={rows}
              rowKey={(row) => row.mentorship_id}
              empty={(
                <EmptyState icon="◌" title="No mentorships match the filters">
                  Try another status.
                </EmptyState>
              )}
              columns={[
                {
                  key: 'people',
                  label: 'Student and mentor',
                  render: (row) => (
                    <div>
                      <div className="fw-semibold">{row.student_name}</div>
                      <div className="small text-muted">Mentor: {row.mentor_name}</div>
                    </div>
                  ),
                },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'started', label: 'Started', render: (row) => <span className="small">{fmtDate(row.started_at)}</span> },
                {
                  key: 'ended',
                  label: 'Ended',
                  render: (row) => <span className="small text-muted">{row.ended_at ? fmtDate(row.ended_at) : '—'}</span>,
                },
                {
                  key: 'sessions',
                  label: 'Sessions completed',
                  render: (row) => <span className="small">{row.sessions_completed ?? 0}</span>,
                },
                {
                  key: 'actions',
                  label: '',
                  className: 'text-end',
                  render: (row) => (
                    <Button size="sm" variant="outline-secondary" onClick={() => open(row)}>View details</Button>
                  ),
                },
              ]}
              mobileTitle={(row) => `${row.student_name} → ${row.mentor_name}`}
            />
          </Panel>
          <Pager meta={list.data?.meta} onPage={setPage} />
        </>
      )}

      <MentorshipDrawer
        show={drawerOpen}
        mentorshipId={selected?.mentorship_id}
        onHide={closeDrawer}
        onChanged={() => {
          toast.success('Mentorship updated.');
          list.reload({ silent: true });
        }}
      />
    </>
  );
}

const REQUEST_STATUSES = [
  ['', 'All statuses'],
  ['pending', 'Pending'],
  ['accepted', 'Accepted'],
  ['declined', 'Declined'],
  ['cancelled', 'Cancelled'],
  ['expired', 'Expired'],
];

function AdminRequestsPanel() {
  const [filters, setFilters] = useState({ status: '', olderThan: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [drawerRequest, setDrawerRequest] = useState(null);

  const list = useApi(
    () => get('/admin/mentoring-requests', {
      status: applied.status || undefined,
      older_than_days: applied.olderThan ? Number(applied.olderThan) : undefined,
      page,
      page_size: 10,
    }),
    [applied, page],
  );

  const rows = list.data?.data || [];

  const apply = (event) => {
    if (event) event.preventDefault();
    setApplied({ ...filters });
    setPage(1);
  };

  const clear = () => {
    const blank = { status: '', olderThan: '' };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  };

  const staleOnly = () => {
    const next = { status: 'pending', olderThan: '10' };
    setFilters(next);
    setApplied(next);
    setPage(1);
  };

  return (
    <>
      <Panel className="mb-3">
        <Form className="d-flex flex-wrap gap-2 align-items-end" onSubmit={apply}>
          <div style={{ minWidth: 190 }}>
            <Form.Label className="small mb-1">Status</Form.Label>
            <Form.Select
              size="sm" value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              {REQUEST_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Form.Select>
          </div>
          <div style={{ width: 180 }}>
            <Form.Label className="small mb-1">Older than (days)</Form.Label>
            <Form.Control
              size="sm" type="number" min={1} max={365} value={filters.olderThan}
              onChange={(event) => setFilters((current) => ({ ...current, olderThan: event.target.value }))}
            />
          </div>
          <Button size="sm" type="submit" variant="primary">Apply filters</Button>
          <Button size="sm" type="button" variant="outline-secondary" onClick={staleOnly}>Stale pending (10+)</Button>
          <div className="small text-muted pb-2 ms-auto">Rows pending longer than ten days are highlighted.</div>
        </Form>
      </Panel>

      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.loading && <Loading label="Loading requests…" rows={5} />}

      {!list.loading && !list.error && (
        <>
          <Panel bodyClassName="p-0">
            <DataTable
              rows={rows}
              rowKey={(row) => row.request_id}
              empty={(
                <EmptyState icon="✉" title="No requests match the filters">
                  Change the status or remove the age filter.
                </EmptyState>
              )}
              columns={[
                {
                  key: 'people',
                  label: 'Student and mentor',
                  render: (row) => (
                    <div>
                      <div className="fw-semibold">{row.student_name}</div>
                      <div className="small text-muted">Mentor: {row.mentor_name}</div>
                    </div>
                  ),
                },
                {
                  key: 'goal',
                  label: 'Career goal',
                  render: (row) => (
                    <span className="text-truncate d-inline-block" style={{ maxWidth: '34ch' }} title={row.career_goal}>
                      {row.career_goal}
                    </span>
                  ),
                },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                {
                  key: 'age',
                  label: 'Age',
                  render: (row) => {
                    const age = daysSince(row.created_at);
                    const stale = row.status === 'pending' && age >= 10;
                    return (
                      <span className={stale ? 'text-danger fw-semibold small' : 'small text-muted'}>
                        {age} day{age === 1 ? '' : 's'}{stale ? ' · stale' : ''}
                      </span>
                    );
                  },
                },
                {
                  key: 'sent',
                  label: 'Sent',
                  render: (row) => <span className="small text-muted">{fmtDate(row.created_at)}</span>,
                },
                {
                  key: 'actions',
                  label: '',
                  className: 'text-end',
                  render: (row) => (
                    <Button size="sm" variant="outline-secondary" onClick={() => setDrawerRequest(row.request_id)}>
                      View
                    </Button>
                  ),
                },
              ]}
              mobileTitle={(row) => `${row.student_name} → ${row.mentor_name}`}
            />
          </Panel>
          <Pager meta={list.data?.meta} onPage={setPage} />
        </>
      )}

      <RequestDrawer
        show={Boolean(drawerRequest)}
        requestId={drawerRequest}
        onHide={() => setDrawerRequest(null)}
        title="Request details"
      />
    </>
  );
}

export function AdminMentorships() {
  useTitle('Mentorship management');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'requests' ? 'requests' : 'mentorships';
  const setTab = (next) => setParams(next === 'requests' ? { tab: 'requests' } : {}, { replace: true });

  return (
    <>
      <PageHeader
        title="Mentorship management"
        subtitle="Oversee relationships, inspect sessions and follow up on long-pending requests."
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'mentorships', label: 'Mentorships' },
          { key: 'requests', label: 'Requests' },
        ]}
      />
      {tab === 'mentorships' ? <MentorshipsPanel /> : <AdminRequestsPanel />}
    </>
  );
}

/* ================================================================== page 26 */

const TREND_METRICS = [
  ['requests', 'Requests'],
  ['acceptances', 'Acceptances'],
  ['sessions', 'Sessions'],
  ['active_users', 'Active users'],
];

const EXPORT_REPORTS = [
  ['mentorships', 'Mentorships'],
  ['requests', 'Requests'],
  ['sessions', 'Sessions'],
  ['participation', 'Mentor participation'],
];

export function AdminAnalytics() {
  useTitle('Programme analytics');
  const toast = useToast();
  const [range, setRange] = useState(() => presetRange(90));
  const [applied, setApplied] = useState(range);
  const [metric, setMetric] = useState('requests');
  const [bucket, setBucket] = useState('week');
  const [report, setReport] = useState('mentorships');
  const [exporting, setExporting] = useState(false);

  const overview = useApi(
    () => get('/admin/analytics/overview', { from: applied.from, to: applied.to }),
    [applied.from, applied.to],
  );
  const trend = useApi(
    () => get('/admin/analytics/trends', { metric, interval: bucket, from: applied.from, to: applied.to }),
    [applied.from, applied.to, metric, bucket],
  );

  const data = overview.data?.data;
  const series = trend.data?.data?.series || [];
  const distribution = data?.feedback?.rating_distribution || {};
  const distributionMax = Math.max(1, ...Object.values(distribution).map((value) => Number(value) || 0));
  const noData = data
    && data.requests.total === 0
    && data.sessions.scheduled + data.sessions.completed + data.sessions.cancelled === 0
    && data.feedback.count === 0;

  const funnel = data ? [
    { label: 'Requests received', value: data.requests.total },
    { label: 'Requests accepted', value: data.requests.accepted },
    { label: 'Mentorships started', value: data.mentorships.active + data.mentorships.completed + data.mentorships.ended },
    { label: '3+ completed sessions', value: data.mentorships.with_three_or_more_sessions },
    { label: 'Sessions with feedback', value: data.feedback.count },
  ] : [];

  const doExport = async () => {
    setExporting(true);
    try {
      const name = await downloadCsv('/admin/analytics/export', {
        report, from: applied.from, to: applied.to,
      });
      toast.success(`Downloaded ${name}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Programme analytics"
        subtitle="Participation and programme effectiveness. Counts only — no personal data leaves the platform."
      />

      <Panel className="mb-3" title="Date range" subtitle="Applies to every panel and to exports.">
        <DateRangeBar range={range} setRange={setRange} onApply={setApplied} busy={overview.loading || trend.loading} />
      </Panel>

      {overview.error && <ApiErrorBanner error={overview.error} onRetry={overview.reload} />}
      {noData && (
        <Alert variant="info" className="py-2 small">
          No data for this period. Try a wider date range.
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col sm={6} xl={3}>
          <StatCard
            label="Acceptance rate"
            value={overview.loading ? '—' : data ? `${Math.round((data.requests.acceptance_rate || 0) * 100)}%` : '—'}
            hint={data ? `${data.requests.accepted} of ${data.requests.accepted + data.requests.declined} decided` : '—'}
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Median response time"
            value={overview.loading ? '—' : (data?.requests?.median_response_hours != null ? `${data.requests.median_response_hours} h` : '—')}
            hint="From request to decision"
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Mentor utilisation"
            value={overview.loading ? '—' : data ? `${Math.round((data.mentors.utilisation || 0) * 100)}%` : '—'}
            hint={data ? `${data.mentors.approved} approved · ${data.mentors.capacity_total} spots` : '—'}
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Average rating"
            value={overview.loading ? '—' : (data?.feedback?.average_rating != null ? data.feedback.average_rating.toFixed(2) : '—')}
            hint={data ? `${data.feedback.count} ratings` : '—'}
          />
        </Col>
      </Row>

      <Row className="g-3">
        <Col xl={7}>
          <Panel
            title="Participation funnel"
            subtitle="Requests through to rated sessions in the selected period."
          >
            {overview.loading && <Loading label="Loading funnel…" rows={4} />}
            {!overview.loading && !overview.error && (funnel.length === 0 || funnel[0].value === 0)
              ? <EmptyState icon="◔" title="No data for this period">Widen the range to see the funnel.</EmptyState>
              : <Funnel steps={funnel} />}
          </Panel>

          <Panel title="Rating distribution" className="mt-3" subtitle="Feedback submitted in the selected period.">
            {overview.loading && <Loading label="Loading ratings…" rows={3} />}
            {!overview.loading && !overview.error && (
              Number(data?.feedback?.count || 0) === 0 ? (
                <EmptyState icon="☆" title="No feedback in this period" />
              ) : (
                <div>
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = Number(distribution[String(rating)] || 0);
                    return (
                      <div className="funnel-row" key={rating}>
                        <div className="funnel-label">{rating} star{rating === 1 ? '' : 's'}</div>
                        <div className="funnel-track">
                          <div className="funnel-bar" style={{ width: `${Math.max(1, (count / distributionMax) * 100)}%` }} />
                        </div>
                        <div className="funnel-value">{suppress(count)}</div>
                      </div>
                    );
                  })}
                  <div className="small text-muted mt-2">Groups with fewer than five responses are shown as &lt;5.</div>
                </div>
              )
            )}
          </Panel>
        </Col>

        <Col xl={5}>
          <Panel
            title="Trend"
            subtitle={`${TREND_METRICS.find(([key]) => key === metric)?.[1] || metric} by ${bucket}.`}
          >
            <div className="d-flex flex-wrap gap-2 mb-3">
              <Form.Select
                size="sm" style={{ width: 170 }} value={metric}
                onChange={(event) => setMetric(event.target.value)}
                aria-label="Trend metric"
              >
                {TREND_METRICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Form.Select>
              <Form.Select
                size="sm" style={{ width: 130 }} value={bucket}
                onChange={(event) => setBucket(event.target.value)}
                aria-label="Trend interval"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </Form.Select>
            </div>

            {trend.loading && <Loading label="Loading trend…" rows={4} />}
            {trend.error && <ErrorState error={trend.error} onRetry={trend.reload} />}
            {!trend.loading && !trend.error && (
              <TrendBars series={series} valueLabel={metric.replace('_', ' ')} />
            )}
          </Panel>

          <Panel title="Export a report" className="mt-3" subtitle="CSV, for the selected range.">
            <div className="d-flex flex-wrap gap-2 align-items-end">
              <div className="flex-grow-1">
                <Form.Label className="small mb-1">Report</Form.Label>
                <Form.Select size="sm" value={report} onChange={(event) => setReport(event.target.value)}>
                  {EXPORT_REPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </div>
              <Button variant="primary" onClick={doExport} disabled={exporting}>
                {exporting && <Spinner animation="border" size="sm" className="me-2" />}
                Export CSV
              </Button>
            </div>
            <div className="small text-muted mt-2">
              Exports contain identifiers and counts for programme administration only. Feedback comments are never exported.
            </div>
          </Panel>

          <Panel title="Privacy" className="mt-3">
            <p className="small text-muted mb-0">
              Analytics show aggregate counts. Groups smaller than five are suppressed, and no free-text feedback or
              personal contact details appear in reports. Access is limited to administrators and every export is
              audit-logged.
            </p>
          </Panel>
        </Col>
      </Row>
    </>
  );
}
