import { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { del, getAll, get, patch, post } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/toast.jsx';
import {
  ApiErrorBanner, Chip, DataTable, EmptyState, ErrorState, Loading, PageHeader, Panel, STAGE_LABEL,
  LEVEL_LABEL, StatusBadge, Tabs, StatCard, useApi, useTitle, fmtDate, fmtDateTime, fmtTime, fmtDay,
  timeAgo, untilText, toDateInput, toTimeInput, initials,
} from '../components/ui.jsx';
import {
  BookingDialog, ConfirmDialog, FeedbackDialog, ReasonDialog, SessionEditDialog, SlotEditorDialog,
} from '../components/dialogs.jsx';
import { InterestPicker, MissingFieldsNote, PasswordForm, SkillPicker } from '../components/editors.jsx';
import { NotificationsPage } from './student.jsx';

/* ------------------------------------------------------------------ helpers */

const startOfWeek = (input) => {
  const date = new Date(input);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const STATUS_MESSAGES = {
  draft: {
    variant: 'warning',
    heading: 'Your profile is a draft.',
    body: 'Add your professional details, expertise and availability, then submit for review. Mentees cannot find you until an administrator approves the profile.',
    action: { label: 'Complete profile', to: '/mentor/profile' },
  },
  pending_review: {
    variant: 'info',
    heading: 'Your profile is awaiting review.',
    body: 'An administrator will check your application. Requests cannot arrive until the profile is approved.',
    action: { label: 'Review my profile', to: '/mentor/profile' },
  },
  rejected: {
    variant: 'danger',
    heading: 'Your profile was not approved.',
    body: 'Read the reviewer note, update your details and submit again.',
    action: { label: 'Open profile', to: '/mentor/profile' },
  },
  suspended: {
    variant: 'danger',
    heading: 'Your mentor profile is suspended.',
    body: 'Contact the programme office to discuss reinstatement. New requests are paused.',
    action: null,
  },
};

/* ================================================================== page 15 */

export function MentorDashboard() {
  useTitle('Mentor dashboard');
  const toast = useToast();
  const { user } = useAuth();
  const dashboard = useApi(() => get('/mentors/me/dashboard'), []);
  const profile = useApi(() => get('/mentors/me/profile'), []);
  const requests = useApi(() => get('/mentoring-requests/mine', { status: 'pending', page_size: 5 }), []);
  const [accepting, setAccepting] = useState(true);
  const [toggling, setToggling] = useState(false);

  const data = dashboard.data?.data;
  const me = profile.data?.data;

  useEffect(() => {
    if (me) setAccepting(Boolean(me.is_available));
  }, [me]);

  const status = data?.profile_status || me?.profile_status || 'draft';
  const banner = STATUS_MESSAGES[status];
  const pendingRows = requests.data?.data || [];

  const toggleAccepting = async () => {
    const next = !accepting;
    setAccepting(next);
    setToggling(true);
    try {
      await patch('/mentors/me/profile', { is_available: next });
      toast.success(next ? 'You are accepting new mentee requests.' : 'New requests are paused.');
      dashboard.reload({ silent: true });
      profile.reload({ silent: true });
    } catch (err) {
      setAccepting(!next);
      toast.error(err.message);
    } finally {
      setToggling(false);
    }
  };

  const capacity = data?.max_active_mentees || me?.max_active_mentees || 3;
  const active = data?.active_mentees ?? 0;
  const percent = Math.min(100, Math.round((active / Math.max(1, capacity)) * 100));

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(' ')[0] || 'mentor'}`}
        subtitle="Review status, workload and what needs your attention."
        actions={(
          <>
            <Link to="/mentor/requests" className="btn btn-outline-primary">Review requests</Link>
            <Link to="/mentor/schedule" className="btn btn-primary">View schedule</Link>
          </>
        )}
      />

      {banner && (
        <Alert variant={banner.variant} className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>{banner.heading}</strong> {banner.body}
            {status === 'rejected' && me?.review_note && (
              <div className="mt-1 small"><strong>Reviewer note:</strong> {me.review_note}</div>
            )}
          </div>
          {banner.action && <Link to={banner.action.to} className="btn btn-sm btn-outline-dark">{banner.action.label}</Link>}
        </Alert>
      )}

      {dashboard.error && <ApiErrorBanner error={dashboard.error} onRetry={dashboard.reload} />}

      <Row className="g-3 mb-3">
        <Col sm={6} xl={3}>
          <StatCard label="Pending requests" value={dashboard.loading ? '—' : data?.pending_requests ?? 0} to="/mentor/requests" hint="Awaiting your decision" />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard label="Active mentees" value={dashboard.loading ? '—' : `${active} / ${capacity}`} to="/mentor/mentees" hint="Capacity used" />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard label="Upcoming sessions" value={dashboard.loading ? '—' : (data?.upcoming_sessions || []).length} to="/mentor/schedule" hint="Next five on the calendar" />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Student reviews"
            value={data?.review_summary?.count ?? 0}
            hint="Written reviews from completed sessions"
          />
        </Col>
      </Row>

      <Row className="g-3">
        <Col xl={7}>
          <Panel
            title="Incoming requests"
            actions={<Link to="/mentor/requests" className="btn btn-sm btn-outline-primary">All requests</Link>}
          >
            {requests.loading && <Loading label="Loading requests…" rows={2} />}
            {requests.error && <ErrorState error={requests.error} onRetry={requests.reload} />}
            {!requests.loading && !requests.error && pendingRows.length === 0 && (
              <EmptyState icon="✉" title="No pending requests">
                New requests will appear here.
              </EmptyState>
            )}
            <div className="list-tight">
              {pendingRows.map((request) => (
                <div key={request.request_id} className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                  <div>
                    <div className="fw-semibold">{request.student_name}</div>
                    <div className="small text-muted text-truncate" style={{ maxWidth: '46ch' }}>{request.career_goal}</div>
                    <div className="small text-muted">{untilText(request.expires_at)} to respond</div>
                  </div>
                  <Link to={`/mentor/requests/${request.request_id}`} className="btn btn-sm btn-outline-primary">View</Link>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Upcoming sessions"
            className="mt-3"
            actions={<Link to="/mentor/schedule" className="btn btn-sm btn-outline-primary">Open schedule</Link>}
          >
            {dashboard.loading && <Loading label="Loading sessions…" rows={2} />}
            {!dashboard.loading && (data?.upcoming_sessions || []).length === 0 && (
              <EmptyState icon="◷" title="Nothing scheduled">
                Book a session with one of your mentees.
              </EmptyState>
            )}
            <div className="list-tight">
              {(data?.upcoming_sessions || []).map((session) => (
                <div key={session.session_id} className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                  <div>
                    <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
                    <div className="small text-muted">with {session.student_name} · {session.meeting_mode.replace('_', ' ')}</div>
                  </div>
                  {session.meeting_link && <a className="btn btn-sm btn-teal" aria-disabled="true" title="Presentation only: external meetings are disabled in this demo.">Join (demo only)</a>}
                </div>
              ))}
            </div>
          </Panel>
        </Col>

        <Col xl={5}>
          <Panel title="Workload">
            <div className="d-flex justify-content-between small mb-1">
              <span className="text-muted">Capacity</span>
              <span className="fw-semibold">{active} of {capacity} mentee spots used</span>
            </div>
            <ProgressBar now={percent} variant={percent >= 100 ? 'danger' : percent >= 70 ? 'warning' : 'success'} />
            <div className="d-flex justify-content-between mt-3 align-items-center">
              <div>
                <div className="fw-semibold small">Accepting new mentees</div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  Pausing hides you from new requests but keeps current mentorships.
                </div>
              </div>
              <Form.Check
                type="switch"
                id="accepting-toggle"
                checked={accepting}
                disabled={toggling || status !== 'approved'}
                onChange={toggleAccepting}
                aria-label="Accepting new mentees"
              />
            </div>
            {status !== 'approved' && (
              <div className="policy-note mt-3">The switch is available after your profile is approved.</div>
            )}
            <Link to="/mentor/profile" className="btn btn-sm btn-outline-primary mt-3">Edit capacity in profile</Link>
          </Panel>

          <Panel title="Student reviews" className="mt-3">
            <div className="stat-value">{data?.review_summary?.count ?? 0}</div>
            <p className="text-muted small mb-0">Written session reviews help students, mentors and administrators follow the mentoring journey.</p>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== page 16 */

export function MentorRequests() {
  useTitle('Incoming requests');
  const navigate = useNavigate();
  const toast = useToast();
  const requests = useApi(() => getAll('/mentoring-requests/mine'), []);
  const dashboard = useApi(() => get('/mentors/me/dashboard'), []);
  const [tab, setTab] = useState('pending');
  const [details, setDetails] = useState({});
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [actionError, setActionError] = useState(null);

  const rows = requests.data || [];
  const tabs = [
    { key: 'pending', label: 'Pending', match: (row) => row.status === 'pending' },
    { key: 'accepted', label: 'Accepted', match: (row) => row.status === 'accepted' },
    { key: 'declined', label: 'Declined', match: (row) => row.status === 'declined' },
    { key: 'all', label: 'All', match: () => true },
  ];
  const filtered = rows.filter(tabs.find((entry) => entry.key === tab).match);

  useEffect(() => {
    const missing = rows.filter((row) => row.status === 'pending' && !details[row.request_id]);
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(missing.map((row) => get(`/mentoring-requests/${row.request_id}`)
      .then((envelope) => [row.request_id, envelope.data])
      .catch(() => [row.request_id, null])))
      .then((pairs) => {
        if (!alive) return;
        setDetails((current) => {
          const next = { ...current };
          pairs.forEach(([id, value]) => { next[id] = value; });
          return next;
        });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests.data]);

  const refresh = () => {
    requests.reload({ silent: true });
    dashboard.reload({ silent: true });
  };

  const accept = async () => {
    try {
      const envelope = await post(`/mentoring-requests/${acceptTarget.request_id}/accept`);
      toast.success(`Request accepted — mentorship started with ${acceptTarget.student_name}.`);
      setAcceptTarget(null);
      refresh();
      return envelope;
    } catch (err) {
      setActionError(err);
      throw err;
    }
  };

  const decline = async ({ reason }) => {
    try {
      await post(`/mentoring-requests/${declineTarget.request_id}/decline`, { reason: reason || null });
      toast.success('Request declined. A local demo notification was added.');
      refresh();
    } catch (err) {
      if (err.code === 'INVALID_STATE_TRANSITION') {
        toast.error('That request was already decided. The list has been refreshed.');
        refresh();
      }
      throw err;
    }
  };

  const capacity = dashboard.data?.data?.max_active_mentees ?? 3;
  const active = dashboard.data?.data?.active_mentees ?? 0;

  return (
    <>
      <PageHeader
        title="Incoming requests"
        subtitle={`${active} of ${capacity} mentee spots used. Requests expire after 14 days.`}
        actions={<Link to="/mentor/profile" className="btn btn-outline-primary">Capacity settings</Link>}
      />

      {actionError && (
        <Alert variant="warning" className="py-2">
          <div className="fw-semibold">{actionError.code.replaceAll('_', ' ').toLowerCase()}</div>
          <div>{actionError.message}</div>
          {actionError.code === 'MENTOR_AT_CAPACITY' && (
            <Link to="/mentor/profile" className="alert-link">Increase capacity or close a mentorship</Link>
          )}
          <Button size="sm" variant="link" className="p-0 ms-2 align-baseline" onClick={() => setActionError(null)}>Dismiss</Button>
        </Alert>
      )}

      {requests.loading && <Loading label="Loading requests…" rows={4} />}
      {requests.error && <ErrorState error={requests.error} onRetry={requests.reload} />}

      {!requests.loading && !requests.error && (
        <>
          <Tabs active={tab} onChange={setTab} tabs={tabs.map((entry) => ({ ...entry, count: rows.filter(entry.match).length }))} />

          <Panel bodyClassName="p-0">
            <DataTable
              rows={filtered}
              rowKey={(row) => row.request_id}
              empty={<EmptyState icon="✉" title={tab === 'pending' ? 'No pending requests' : 'Nothing here'}>Requests appear as students send them.</EmptyState>}
              columns={[
                {
                  key: 'student',
                  label: 'Student',
                  render: (row) => (
                    <div>
                      <div className="fw-semibold">{row.student_name}</div>
                      <div className="small text-muted">
                        {details[row.request_id]?.student_summary?.programme_stage
                          ? STAGE_LABEL[details[row.request_id].student_summary.programme_stage]
                          : '—'}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'goal',
                  label: 'Career goal',
                  render: (row) => (
                    <span className="text-truncate d-inline-block" style={{ maxWidth: '34ch' }} title={row.career_goal}>{row.career_goal}</span>
                  ),
                },
                { key: 'received', label: 'Received', render: (row) => <span className="small text-muted">{timeAgo(row.created_at)}</span> },
                {
                  key: 'expiry',
                  label: 'Time left',
                  render: (row) => (row.status === 'pending'
                    ? <span className="small text-muted">{untilText(row.expires_at)}</span>
                    : <StatusBadge status={row.status} />),
                },
                {
                  key: 'actions',
                  label: '',
                  className: 'text-end',
                  render: (row) => (
                    <div className="d-flex gap-1 justify-content-end flex-wrap">
                      <Button size="sm" variant="outline-secondary" onClick={() => navigate(`/mentor/requests/${row.request_id}`)}>View</Button>
                      {row.status === 'pending' && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => setAcceptTarget(row)}>Accept</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => setDeclineTarget(row)}>Decline</Button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
              mobileTitle={(row) => row.student_name}
            />
          </Panel>
        </>
      )}

      <ConfirmDialog
        show={Boolean(acceptTarget)}
        onHide={() => setAcceptTarget(null)}
        title="Accept this request?"
        confirmLabel="Accept request"
        variant="primary"
        onConfirm={accept}
      >
        {acceptTarget && (
          <div className="note-box small">
            <div><strong>{acceptTarget.student_name}</strong> · {untilText(acceptTarget.expires_at)} left</div>
            <div className="text-muted mt-1">{acceptTarget.career_goal}</div>
            <div className="text-muted mt-2">
              This creates an active mentorship. You are using {active} of {capacity} spots.
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ReasonDialog
        show={Boolean(declineTarget)}
        onHide={() => setDeclineTarget(null)}
        title="Decline this request?"
        prompt="The reason is optional and is shared with the student. A declined request starts a 14-day cooldown."
        confirmLabel="Decline request"
        onSubmit={decline}
        reasons={['At capacity this term', 'Not a good fit for the goal', 'Please ask another mentor']}
      />
    </>
  );
}

/* ================================================================== page 17 */

export function MentorRequestDetail() {
  useTitle('Request details');
  const { request_id: requestId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const request = useApi(() => get(`/mentoring-requests/${requestId}`), [requestId]);
  const profile = useApi(() => get('/mentors/me/profile'), [requestId]);
  const dashboard = useApi(() => get('/mentors/me/dashboard'), [requestId]);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  const data = request.data?.data;
  const student = data?.student_summary;
  const me = profile.data?.data;
  const expertise = new Set((me?.expertise || []).map((skill) => skill.skill_id));

  const capacity = dashboard.data?.data?.max_active_mentees ?? me?.max_active_mentees ?? 3;
  const active = dashboard.data?.data?.active_mentees ?? 0;

  const accept = async () => {
    try {
      const envelope = await post(`/mentoring-requests/${requestId}/accept`);
      toast.success(`Request accepted — mentorship started with ${data.student_name}.`);
      navigate(`/mentor/mentees?mentorship=${envelope.data.mentorship.mentorship_id}`);
    } catch (err) {
      setActionError(err);
      throw err;
    }
  };

  const decline = async ({ reason }) => {
    await post(`/mentoring-requests/${requestId}/decline`, { reason: reason || null });
    toast.success('Request declined. A local demo notification was added.');
    navigate('/mentor/requests');
  };

  if (request.loading) return <Loading label="Loading request…" rows={6} />;
  if (request.error) {
    return (
      <>
        <PageHeader title="Request details" actions={<Link to="/mentor/requests" className="btn btn-outline-secondary">Back to requests</Link>} />
        {request.error.code === 'NOT_FOUND'
          ? <EmptyState icon="◌" title="Request not available">It may belong to another mentor or have been removed.</EmptyState>
          : <ErrorState error={request.error} onRetry={request.reload} />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={data.student_name}
        subtitle={`Request received ${fmtDate(data.created_at)} · ${untilText(data.expires_at)} to respond`}
        actions={(
          <>
            <Link to="/mentor/requests" className="btn btn-outline-secondary">Back to requests</Link>
            {data.status === 'pending' && (
              <>
                <Button variant="primary" onClick={() => setConfirmAccept(true)}>Accept</Button>
                <Button variant="outline-danger" onClick={() => setDeclineOpen(true)}>Decline</Button>
              </>
            )}
          </>
        )}
      />

      {actionError && (
        <Alert variant="warning" className="py-2">
          <div className="fw-semibold">{actionError.code.replaceAll('_', ' ').toLowerCase()}</div>
          <div>{actionError.message}</div>
          {actionError.code === 'MENTOR_AT_CAPACITY' && <Link to="/mentor/profile" className="alert-link">Increase capacity</Link>}
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={8}>
          <Panel>
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div className="small-label">Career goal</div>
                <p className="mt-1 mb-3">{data.career_goal}</p>
                {data.message && (
                  <>
                    <div className="small-label">Message</div>
                    <p className="mt-1 mb-0">{data.message}</p>
                  </>
                )}
              </div>
              <StatusBadge status={data.status} />
            </div>
            {data.status_reason && (
              <div className="review-note mt-3">
                <div className="small-label mb-1">Decision note</div>
                {data.status_reason}
              </div>
            )}
          </Panel>

          <Panel title="Student profile" className="mt-3">
            {student ? (
              <>
                <Row className="g-3">
                  <Col sm={6}>
                    <div className="small-label">Programme stage</div>
                    <div>{STAGE_LABEL[student.programme_stage] || 'Not set'}</div>
                  </Col>
                  <Col sm={6}>
                    <div className="small-label">Expected graduation</div>
                    <div>{student.expected_graduation_year || 'Not set'}</div>
                  </Col>
                </Row>
                <div className="small-label mt-3">Bio</div>
                <p className="small">{student.bio || 'Not provided'}</p>
                <div className="small-label">Career goals</div>
                <p className="small">{student.career_goals || 'Not provided'}</p>
                <div className="small-label">Guidance needs</div>
                <p className="small">{student.guidance_needs || 'Not provided'}</p>

                <div className="small-label mt-3">Skills</div>
                <div className="mt-1">
                  {(student.skills || []).map((skill) => (
                    <Chip
                      key={skill.skill_id}
                      title={expertise.has(skill.skill_id) ? 'Matches your expertise' : undefined}
                    >
                      {expertise.has(skill.skill_id) && <span className="text-success me-1" aria-label="Overlap">●</span>}
                      {skill.skill_name} · {LEVEL_LABEL[skill.proficiency_level]}{skill.is_focus ? ' ★' : ''}
                    </Chip>
                  ))}
                  {(student.skills || []).length === 0 && <span className="text-muted small">None listed</span>}
                </div>
                <div className="small-label mt-3">Career interests</div>
                <div className="mt-1">
                  {(student.interests || []).map((interest) => <Chip key={interest}>{interest}</Chip>)}
                  {(student.interests || []).length === 0 && <span className="text-muted small">None listed</span>}
                </div>
                <div className="form-text mt-2">● marks skills that overlap with your expertise.</div>
              </>
            ) : <p className="text-muted small mb-0">No profile summary is available for this request.</p>}
          </Panel>
        </Col>

        <Col lg={4}>
          <Panel title="Capacity">
            <div className="d-flex justify-content-between py-1"><span className="text-muted">Active mentees</span><span className="fw-semibold">{active} / {capacity}</span></div>
            <div className="d-flex justify-content-between py-1"><span className="text-muted">Free spots</span><span className="fw-semibold">{Math.max(0, capacity - active)}</span></div>
            <div className="d-flex justify-content-between py-1"><span className="text-muted">After accepting</span><span className="fw-semibold">{Math.max(0, capacity - active - 1)} free</span></div>
            {active >= capacity && (
              <div className="review-note mt-3">You are at capacity. Close a mentorship or raise the limit in your profile.</div>
            )}
            <div className="policy-note mt-3">
              Accepting creates a local mentorship and a simulated notification. Session times become
              visible to them after acceptance.
            </div>
          </Panel>
        </Col>
      </Row>

      <ConfirmDialog
        show={confirmAccept}
        onHide={() => setConfirmAccept(false)}
        title="Accept this request?"
        confirmLabel="Accept request"
        onConfirm={accept}
      >
        <div className="note-box small">
          This starts an active mentorship with <strong>{data.student_name}</strong>. You will be able to
          schedule sessions from My mentees.
        </div>
      </ConfirmDialog>

      <ReasonDialog
        show={declineOpen}
        onHide={() => setDeclineOpen(false)}
        title="Decline this request?"
        prompt="The reason is optional and is shared with the student."
        confirmLabel="Decline request"
        onSubmit={decline}
        reasons={['At capacity this term', 'Not a good fit for the goal', 'Please ask another mentor']}
      />
    </>
  );
}

/* ================================================================== page 18 */

export function Mentees() {
  useTitle('My mentees');
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const mentorships = useApi(() => getAll('/mentorships'), []);
  const [tab, setTab] = useState('active');
  const [selected, setSelected] = useState(params.get('mentorship') || '');
  const [booking, setBooking] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cancelSession, setCancelSession] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);
  const [editSession, setEditSession] = useState(null);

  const all = mentorships.data || [];
  const activeRows = all.filter((row) => row.status === 'active');
  const closedRows = all.filter((row) => ['completed', 'ended'].includes(row.status));

  useEffect(() => {
    if (selected) return;
    if (activeRows.length) setSelected(activeRows[0].mentorship_id);
    else if (closedRows.length) setSelected(closedRows[0].mentorship_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorships.data]);

  const choose = (id) => {
    setSelected(id);
    setParams({ mentorship: id }, { replace: true });
  };

  const bundle = useApi(async () => {
    if (!selected) return null;
    const detail = (await get(`/mentorships/${selected}`)).data;
    const [sessions, request] = await Promise.all([
      getAll(`/mentorships/${selected}/sessions`),
      detail.request_id
        ? get(`/mentoring-requests/${detail.request_id}`).then((envelope) => envelope.data).catch(() => null)
        : Promise.resolve(null),
    ]);
    return { detail, sessions, request };
  }, [selected], { immediate: Boolean(selected) });

  const detail = bundle.data?.detail;
  const sessions = bundle.data?.sessions || [];
  const request = bundle.data?.request;
  const sessionsCompleted = sessions.filter((session) => session.status === 'completed').length;

  const reloadAll = () => {
    mentorships.reload({ silent: true });
    bundle.reload({ silent: true });
  };

  const markCompleted = async (session) => {
    try {
      await patch(`/sessions/${session.session_id}`, { status: 'completed' });
      toast.success('Session marked completed. You can now leave feedback.');
      reloadAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancel = async ({ reason }) => {
    await patch(`/sessions/${cancelSession.session_id}`, { status: 'cancelled', cancel_reason: reason || null });
    toast.success('Session cancelled.');
    reloadAll();
  };

  const closeMentorship = async ({ reason, choice }) => {
    if (choice === 'ended' && !reason.trim()) throw new Error('A reason is required when ending early.');
    await patch(`/mentorships/${selected}`, { status: choice, reason: reason || null });
    toast.success(choice === 'completed' ? 'Mentorship marked completed.' : 'Mentorship ended.');
    reloadAll();
  };

  const shown = tab === 'active' ? activeRows : closedRows;
  const canComplete = (session) => session.status === 'scheduled' && new Date(session.scheduled_start) <= new Date();

  return (
    <>
      <PageHeader
        title="My mentees"
        subtitle="Manage ongoing mentorships, sessions and feedback."
        actions={<Link to="/mentor/requests" className="btn btn-primary">Find new mentees</Link>}
      />

      {mentorships.loading && <Loading label="Loading mentorships…" rows={3} />}
      {mentorships.error && <ErrorState error={mentorships.error} onRetry={mentorships.reload} />}

      {!mentorships.loading && !mentorships.error && (
        <>
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'active', label: 'Active', count: activeRows.length },
              { key: 'closed', label: 'Closed', count: closedRows.length },
            ]}
          />

          {shown.length === 0 ? (
            <Panel>
              <EmptyState
                icon="◌"
                title={tab === 'active' ? 'No active mentees yet' : 'No closed mentorships'}
                action={<Link to="/mentor/requests" className="btn btn-sm btn-primary">Review requests</Link>}
              >
                {tab === 'active' ? 'Accept a request to start your first mentorship.' : 'Closed mentorships are kept for your records.'}
              </EmptyState>
            </Panel>
          ) : (
            <Row className="g-3">
              <Col lg={4}>
                <Panel title={tab === 'active' ? 'Active mentees' : 'Closed mentorships'} bodyClassName="p-0">
                  <div className="list-tight px-3">
                    {shown.map((row) => (
                      <button
                        key={row.mentorship_id}
                        type="button"
                        className={`w-100 text-start border-0 bg-transparent py-3 ${selected === row.mentorship_id ? 'bg-teal-soft px-2 rounded' : ''}`}
                        onClick={() => choose(row.mentorship_id)}
                      >
                        <div className="d-flex justify-content-between gap-2">
                          <div>
                            <div className="fw-semibold">{row.student_name}</div>
                            <div className="small text-muted">Started {fmtDate(row.started_at)}</div>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              </Col>

              <Col lg={8}>
                {!selected && <Panel><EmptyState icon="◌" title="Choose a mentee" /></Panel>}
                {selected && bundle.loading && <Panel><Loading label="Loading mentorship…" rows={5} /></Panel>}
                {selected && bundle.error && <ErrorState error={bundle.error} onRetry={bundle.reload} />}
                {detail && (
                  <>
                    <Panel
                      title={detail.student_name}
                      subtitle={`Started ${fmtDate(detail.started_at)} · ${sessionsCompleted} session${sessionsCompleted === 1 ? '' : 's'} completed`}
                      actions={(
                        <>
                          {detail.status === 'active' && (
                            <>
                              <Button size="sm" variant="primary" onClick={() => setBooking(true)}>Schedule session</Button>
                              <Button size="sm" variant="outline-danger" onClick={() => setCloseOpen(true)}>Close mentorship</Button>
                            </>
                          )}
                          <Link to={`/mentor/requests`} className="btn btn-sm btn-outline-secondary">Requests</Link>
                        </>
                      )}
                    >
                      <div className="small-label">Career goal</div>
                      <p className="mb-3">{detail.career_goal || request?.career_goal || '—'}</p>

                      {request?.student_summary && (
                        <Row className="g-3">
                          <Col sm={6}>
                            <div className="small-label">Stage</div>
                            <div>{STAGE_LABEL[request.student_summary.programme_stage] || '—'}{request.student_summary.expected_graduation_year ? ` · ${request.student_summary.expected_graduation_year}` : ''}</div>
                          </Col>
                          <Col sm={6}>
                            <div className="small-label">Guidance needs</div>
                            <div className="small">{request.student_summary.guidance_needs || 'Not provided'}</div>
                          </Col>
                          <Col xs={12}>
                            <div className="small-label mt-2">Skills</div>
                            <div>
                              {(request.student_summary.skills || []).map((skill) => (
                                <Chip key={skill.skill_id}>{skill.skill_name} · {LEVEL_LABEL[skill.proficiency_level]}{skill.is_focus ? ' ★' : ''}</Chip>
                              ))}
                            </div>
                          </Col>
                        </Row>
                      )}
                    </Panel>

                    <Panel title="Sessions" className="mt-3" bodyClassName="p-0">
                      {sessions.length === 0 && (
                        <EmptyState icon="◷" title="No sessions yet" action={<Button size="sm" variant="primary" onClick={() => setBooking(true)} disabled={detail.status !== 'active'}>Schedule session</Button>}>
                          Book the first session with this mentee.
                        </EmptyState>
                      )}
                      {sessions.length > 0 && (
                        <div className="list-tight px-3">
                          {sessions
                            .slice()
                            .sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start))
                            .map((session) => (
                              <div key={session.session_id} className="py-3">
                                <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                                  <div>
                                    <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
                                    <div className="small text-muted text-capitalize">
                                      {session.meeting_mode.replace('_', ' ')} · {fmtTime(session.scheduled_end)} end
                                    </div>
                                    {session.notes && <div className="small text-muted mt-1 text-truncate" style={{ maxWidth: '46ch' }}>{session.notes}</div>}
                                  </div>
                                  <div className="d-flex flex-wrap gap-1 align-items-center">
                                    <StatusBadge status={session.status} />
                                    {session.status === 'scheduled' && (
                                      <>
                                        {canComplete(session) && (
                                          <Button size="sm" variant="outline-success" onClick={() => markCompleted(session)}>Mark completed</Button>
                                        )}
                                        <Button size="sm" variant="outline-secondary" onClick={() => setEditSession(session)}>Edit</Button>
                                        <Button size="sm" variant="outline-danger" onClick={() => setCancelSession(session)}>Cancel</Button>
                                      </>
                                    )}
                                    {session.status === 'completed' && !session.my_feedback_submitted && (
                                      <Button size="sm" variant="primary" onClick={() => setRateTarget(session)}>Write review</Button>
                                    )}
                                    {session.status === 'completed' && session.my_feedback_submitted && <Chip>Reviewed</Chip>}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </Panel>
                  </>
                )}
              </Col>
            </Row>
          )}
        </>
      )}

      <BookingDialog
        show={booking}
        onHide={() => setBooking(false)}
        mentorshipId={selected}
        mentorId={detail?.mentor_id}
        mode="mentor"
        onBooked={() => { toast.success('Session booked.'); reloadAll(); }}
      />

      <ReasonDialog
        show={Boolean(cancelSession)}
        onHide={() => setCancelSession(null)}
        title="Cancel this session?"
        prompt={cancelSession ? `${fmtDateTime(cancelSession.scheduled_start)} · a local demo notification is added.` : ''}
        confirmLabel="Cancel session"
        onSubmit={cancel}
      />

      <ReasonDialog
        show={closeOpen}
        onHide={() => setCloseOpen(false)}
        title="Close this mentorship"
        prompt="Future sample sessions are cancelled. A local demo notification is added."
        choice={{
          label: 'How should it close?',
          defaultValue: 'completed',
          options: [
            { value: 'completed', label: 'Completed — goals were met' },
            { value: 'ended', label: 'Ended early — reason required' },
          ],
        }}
        confirmLabel="Close mentorship"
        onSubmit={closeMentorship}
      />

      <FeedbackDialog
        show={Boolean(rateTarget)}
        onHide={() => setRateTarget(null)}
        session={rateTarget ? { ...rateTarget, student_name: detail?.student_name, mentor_name: detail?.mentor_name } : null}
        onSubmitted={() => { toast.success('Review recorded.'); reloadAll(); }}
      />

      <SessionEditDialog
        show={Boolean(editSession)}
        onHide={() => setEditSession(null)}
        session={editSession}
        onSaved={() => { toast.success('Session updated.'); reloadAll(); }}
      />
    </>
  );
}

/* ================================================================== page 19 */

export function MentorSchedule() {
  useTitle('Schedule');
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('sessions');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slotDialog, setSlotDialog] = useState({ open: false, slot: null });
  const [cancelSession, setCancelSession] = useState(null);
  const [editSession, setEditSession] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);

  const weekEnd = addDays(weekStart, 7);
  const availability = useApi(
    () => get('/mentors/me/availability', {
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
      page_size: 50,
    }),
    [weekStart.toISOString(), weekEnd.toISOString()],
  );
  const sessions = useApi(() => getAll('/sessions'), []);

  const slots = availability.data?.data || [];
  const sessionRows = sessions.data || [];
  const upcoming = sessionRows
    .filter((session) => session.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
  const past = sessionRows
    .filter((session) => session.status !== 'scheduled')
    .sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start));

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const addSlots = async (saved) => {
    toast.success('Availability saved.');
    availability.reload({ silent: true });
    return saved;
  };

  const deleteSlot = async (slot) => {
    await del(`/mentors/me/availability/${slot.slot_id}`);
    toast.success('Slot deleted.');
    availability.reload({ silent: true });
  };

  const cancel = async ({ reason }) => {
    await patch(`/sessions/${cancelSession.session_id}`, { status: 'cancelled', cancel_reason: reason || null });
    toast.success('Session cancelled.');
    sessions.reload({ silent: true });
  };

  const markCompleted = async (session) => {
    try {
      await patch(`/sessions/${session.session_id}`, { status: 'completed' });
      toast.success('Session marked completed.');
      sessions.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const canComplete = (session) => session.status === 'scheduled' && new Date(session.scheduled_start) <= new Date();

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Publish availability and run your session calendar."
        actions={<Button variant="primary" onClick={() => setSlotDialog({ open: true, slot: null })}>Add slots</Button>}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'sessions', label: 'Sessions', count: sessionRows.length },
          { key: 'availability', label: 'Availability', count: slots.length },
        ]}
      />

      {tab === 'sessions' && (
        <>
          {sessions.loading && <Loading label="Loading sessions…" rows={4} />}
          {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.reload} />}
          {!sessions.loading && !sessions.error && sessionRows.length === 0 && (
            <Panel><EmptyState icon="◷" title="Nothing scheduled">Once a mentorship is active you can book sessions.</EmptyState></Panel>
          )}
          {sessionRows.length > 0 && (
            <Row className="g-3">
              <Col lg={12}>
                <Panel title="Upcoming sessions" bodyClassName="p-0">
                  {upcoming.length === 0 && <p className="text-muted small p-3 mb-0">No upcoming sessions.</p>}
                  <div className="list-tight px-3">
                    {upcoming.map((session) => (
                      <div key={session.session_id} className="py-3 d-flex flex-wrap justify-content-between gap-2 align-items-center">
                        <div>
                          <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
                          <div className="small text-muted text-capitalize">{session.meeting_mode.replace('_', ' ')} · {fmtTime(session.scheduled_end)} end</div>
                        </div>
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          {session.meeting_link && <a className="btn btn-sm btn-teal" aria-disabled="true" title="Presentation only: external meetings are disabled in this demo.">Join (demo only)</a>}
                          {canComplete(session) && <Button size="sm" variant="outline-success" onClick={() => markCompleted(session)}>Mark completed</Button>}
                          <Button size="sm" variant="outline-secondary" onClick={() => setEditSession(session)}>Edit</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => setCancelSession(session)}>Cancel</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </Col>
              <Col lg={12}>
                <Panel title="Past sessions" bodyClassName="p-0">
                  {past.length === 0 && <p className="text-muted small p-3 mb-0">No past sessions yet.</p>}
                  <div className="list-tight px-3">
                    {past.map((session) => (
                      <div key={session.session_id} className="py-3 d-flex flex-wrap justify-content-between gap-2 align-items-center">
                        <div>
                          <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
                          <div className="small text-muted">with {session.student_name || 'student'}</div>
                        </div>
                        <div className="d-flex gap-1 align-items-center">
                          <StatusBadge status={session.status} />
                          {session.status === 'completed' && !session.my_feedback_submitted && (
                            <Button size="sm" variant="primary" onClick={() => setRateTarget(session)}>Write review</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </Col>
            </Row>
          )}
        </>
      )}

      {tab === 'availability' && (
        <>
          <Panel className="mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div className="d-flex gap-2 align-items-center">
                <Button size="sm" variant="outline-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Previous</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next ›</Button>
              </div>
              <div className="fw-semibold">
                {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
              </div>
            </div>
            <div className="legend mt-3">
              <span><span className="swatch open" /> Open</span>
              <span><span className="swatch booked" /> Booked</span>
              <span><span className="swatch blocked" /> Blocked</span>
            </div>
          </Panel>

          {availability.loading && <Loading label="Loading availability…" rows={3} />}
          {availability.error && <ErrorState error={availability.error} onRetry={availability.reload} />}
          {!availability.loading && !availability.error && (
            <>
              <div className="week-grid mb-3">
                {days.map((day) => {
                  const daySlots = slots
                    .filter((slot) => sameDay(new Date(slot.start_time), day))
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
                  return (
                    <div className="week-col" key={day.toISOString()}>
                      <h6>{fmtDay(day)}</h6>
                      {daySlots.length === 0 && <div className="text-muted" style={{ fontSize: '0.72rem' }}>No slots</div>}
                      {daySlots.map((slot) => (
                        <button
                          key={slot.slot_id}
                          type="button"
                          className={`week-slot ${slot.booked ? 'booked' : slot.is_available ? '' : 'blocked'}`}
                          onClick={() => setSlotDialog({ open: true, slot })}
                          title={slot.booked ? 'Booked — cannot edit times' : 'Edit or delete this slot'}
                        >
                          <div className="fw-semibold">{fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}</div>
                          <div>{slot.booked ? 'Booked' : slot.is_available ? 'Open' : 'Blocked'}</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>

              {slots.length === 0 && (
                <Panel>
                  <EmptyState
                    icon="◷"
                    title="No availability this week"
                    action={<Button size="sm" variant="primary" onClick={() => setSlotDialog({ open: true, slot: null })}>Add availability</Button>}
                  >
                    Publish slots so your mentees can book you.
                  </EmptyState>
                </Panel>
              )}

              <Panel title="This week's slots" bodyClassName="p-0">
                <div className="list-tight px-3">
                  {slots
                    .slice()
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                    .map((slot) => (
                      <div key={slot.slot_id} className="py-2 d-flex flex-wrap justify-content-between gap-2 align-items-center">
                        <div>
                          <span className="fw-semibold">{fmtDay(slot.start_time)} · {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}</span>
                          <StatusBadge status={slot.booked ? 'booked' : slot.is_available ? 'open' : 'blocked'} />
                        </div>
                        <div className="d-flex gap-1">
                          <Button size="sm" variant="outline-secondary" onClick={() => setSlotDialog({ open: true, slot })} disabled={slot.booked}>Edit</Button>
                        </div>
                      </div>
                    ))}
                  {slots.length === 0 && <p className="text-muted small p-3 mb-0">No slots this week.</p>}
                </div>
              </Panel>
            </>
          )}
        </>
      )}

      <SlotEditorDialog
        show={slotDialog.open}
        onHide={() => setSlotDialog({ open: false, slot: null })}
        slot={slotDialog.slot}
        onSaved={addSlots}
        onDelete={slotDialog.slot && !slotDialog.slot.booked ? deleteSlot : undefined}
      />

      <ReasonDialog
        show={Boolean(cancelSession)}
        onHide={() => setCancelSession(null)}
        title="Cancel this session?"
        confirmLabel="Cancel session"
        onSubmit={cancel}
      />

      <SessionEditDialog
        show={Boolean(editSession)}
        onHide={() => setEditSession(null)}
        session={editSession}
        onSaved={() => { toast.success('Session updated.'); sessions.reload({ silent: true }); }}
      />

      <FeedbackDialog
        show={Boolean(rateTarget)}
        onHide={() => setRateTarget(null)}
        session={rateTarget}
        onSubmitted={() => { toast.success('Review recorded.'); sessions.reload({ silent: true }); }}
      />
    </>
  );
}

/* ================================================================== page 20 */

export function MentorProfile() {
  useTitle('Mentor profile');
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const profile = useApi(() => get('/mentors/me/profile'), []);
  const dashboard = useApi(() => get('/mentors/me/dashboard'), []);
  const skillsCatalogue = useApi(() => getAll('/skills'), []);
  const interestsCatalogue = useApi(() => getAll('/career-interests'), []);

  const [tab, setTab] = useState('professional');
  const [form, setForm] = useState({
    full_name: '', mentor_type: 'alumni', professional_title: '', organisation: '',
    experience_years: '', graduation_year: '', linkedin_url: '', bio: '',
    max_active_mentees: 3, is_available: true,
  });
  const [expertise, setExpertise] = useState([]);
  const [interestIds, setInterestIds] = useState([]);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!profile.data || initialised) return;
    const p = profile.data.data;
    const nextForm = {
      full_name: p.full_name || '',
      mentor_type: p.mentor_type || 'alumni',
      professional_title: p.professional_title || '',
      organisation: p.organisation || '',
      experience_years: p.experience_years ?? '',
      graduation_year: p.graduation_year ?? '',
      linkedin_url: p.linkedin_url || '',
      bio: p.bio || '',
      max_active_mentees: p.max_active_mentees ?? 3,
      is_available: p.is_available !== false,
    };
    const nextExpertise = (p.expertise || []).map((skill) => ({ ...skill }));
    const nextInterests = (p.interests || []).map((interest) => interest.interest_id);
    setForm(nextForm);
    setExpertise(nextExpertise);
    setInterestIds(nextInterests);
    setBaseline(JSON.stringify({
      ...nextForm,
      expertise: nextExpertise.map((skill) => ({ skill_id: skill.skill_id, expertise_level: skill.expertise_level })),
      interest_ids: nextInterests,
    }));
    setInitialised(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data, initialised]);

  const payload = useMemo(() => ({
    full_name: form.full_name,
    mentor_type: form.mentor_type,
    professional_title: form.professional_title.trim() || null,
    organisation: form.organisation.trim() || null,
    experience_years: form.experience_years === '' ? null : Number(form.experience_years),
    graduation_year: form.graduation_year === '' ? null : Number(form.graduation_year),
    linkedin_url: form.linkedin_url.trim() || null,
    bio: form.bio.trim() || null,
    max_active_mentees: Number(form.max_active_mentees) || 1,
    is_available: form.is_available,
    expertise: expertise.map((skill) => ({ skill_id: skill.skill_id, expertise_level: skill.expertise_level })),
    interest_ids: interestIds,
  }), [form, expertise, interestIds]);

  const dirty = initialised && JSON.stringify(payload) !== baseline;
  const me = profile.data?.data;
  const status = me?.profile_status || 'draft';

  const missing = [];
  if (!form.professional_title.trim()) missing.push('Professional title');
  if (!form.organisation.trim()) missing.push('Organisation');
  if (form.experience_years === '') missing.push('Years of experience');
  if (!form.bio.trim()) missing.push('Short bio');
  if (expertise.length === 0) missing.push('At least one expertise skill');

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async ({ submit = false } = {}) => {
    setBusy(true);
    setError(null);
    try {
      await patch('/mentors/me/profile', { ...payload, submit_for_review: submit });
      toast.success(submit ? 'Profile submitted for review.' : 'Profile saved.');
      setBaseline(JSON.stringify(payload));
      await profile.reload({ silent: true });
      await dashboard.reload({ silent: true });
      await refreshUser().catch(() => {});
      if (submit) navigate('/mentor/dashboard');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (profile.loading || !initialised) return <Loading label="Loading your profile…" rows={6} />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />;

  const fieldError = (name) => error?.details?.find((detail) => detail.field === name)?.issue;
  const activeMentees = dashboard.data?.data?.active_mentees ?? 0;

  return (
    <>
      <PageHeader
        title="Mentor profile"
        subtitle="Your public professional profile, capacity and review status."
        actions={(
          <>
            {tab !== 'account' && (
              <Button variant="outline-primary" onClick={() => save()} disabled={busy || !dirty}>
                {busy && <Spinner animation="border" size="sm" className="me-2" />}
                Save draft
              </Button>
            )}
            {(status === 'draft' || status === 'rejected') && tab !== 'account' && (
              <Button variant="primary" onClick={() => save({ submit: true })} disabled={busy || missing.length > 0}>
                Submit for review
              </Button>
            )}
          </>
        )}
      />

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span className="small text-muted">Status</span>
        <StatusBadge status={status} />
        {me?.reviewed_at && <span className="small text-muted">Reviewed {fmtDate(me.reviewed_at)}</span>}
      </div>

      {status === 'rejected' && me?.review_note && (
        <div className="review-note mb-3">
          <div className="small-label mb-1">Reviewer note</div>
          {me.review_note}
        </div>
      )}
      {status === 'suspended' && (
        <Alert variant="danger" className="py-2 small">
          Your profile is suspended and hidden from students. Contact the programme office.
        </Alert>
      )}

      {error && <ApiErrorBanner error={error} />}
      {dirty && <Alert variant="info" className="py-2 small">You have unsaved changes.</Alert>}
      {missing.length > 0 && (status === 'draft' || status === 'rejected') && (
        <div className="mb-3"><MissingFieldsNote items={missing} /></div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'professional', label: 'Professional' },
          { key: 'expertise', label: 'Expertise and interests' },
          { key: 'capacity', label: 'Capacity and availability' },
          { key: 'account', label: 'Account' },
        ]}
      />

      <Row className="g-3">
        <Col lg={8}>
          {tab === 'professional' && (
            <Panel title="Professional details">
              <Form>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Full name</Form.Label>
                    <Form.Control value={form.full_name} onChange={setField('full_name')} maxLength={120} isInvalid={Boolean(fieldError('full_name'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('full_name')}</Form.Control.Feedback>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Mentor type</Form.Label>
                    <Form.Select value={form.mentor_type} onChange={setField('mentor_type')}>
                      <option value="alumni">Alumni</option>
                      <option value="recent_graduate">Recent graduate</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Professional title</Form.Label>
                    <Form.Control value={form.professional_title} onChange={setField('professional_title')} maxLength={120} isInvalid={Boolean(fieldError('professional_title'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('professional_title')}</Form.Control.Feedback>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Organisation</Form.Label>
                    <Form.Control value={form.organisation} onChange={setField('organisation')} maxLength={150} isInvalid={Boolean(fieldError('organisation'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('organisation')}</Form.Control.Feedback>
                  </Col>
                  <Col sm={4}>
                    <Form.Label>Years of experience</Form.Label>
                    <Form.Control type="number" min={0} max={60} value={form.experience_years} onChange={setField('experience_years')} isInvalid={Boolean(fieldError('experience_years'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('experience_years')}</Form.Control.Feedback>
                  </Col>
                  <Col sm={4}>
                    <Form.Label>Graduation year</Form.Label>
                    <Form.Control type="number" min={2000} max={2100} value={form.graduation_year} onChange={setField('graduation_year')} isInvalid={Boolean(fieldError('graduation_year'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('graduation_year')}</Form.Control.Feedback>
                  </Col>
                  <Col sm={4}>
                    <Form.Label>LinkedIn URL</Form.Label>
                    <Form.Control type="url" value={form.linkedin_url} onChange={setField('linkedin_url')} placeholder="https://…" isInvalid={Boolean(fieldError('linkedin_url'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('linkedin_url')}</Form.Control.Feedback>
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Bio</Form.Label>
                    <Form.Control as="textarea" rows={5} maxLength={1500} value={form.bio} onChange={setField('bio')} isInvalid={Boolean(fieldError('bio'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('bio')}</Form.Control.Feedback>
                    <div className="char-count text-end">{form.bio.length} / 1500</div>
                  </Col>
                </Row>
              </Form>
            </Panel>
          )}

          {tab === 'expertise' && (
            <Panel title="Expertise and career pathways">
              <h3 className="section-title mb-2">Expertise</h3>
              <SkillPicker
                catalogue={skillsCatalogue.data || []}
                selected={expertise}
                onChange={setExpertise}
                levelKey="expertise_level"
                showFocus={false}
              />
              <hr className="my-4" />
              <h3 className="section-title mb-2">Career pathways you can advise on</h3>
              <InterestPicker catalogue={interestsCatalogue.data || []} selectedIds={interestIds} onChange={setInterestIds} />
            </Panel>
          )}

          {tab === 'capacity' && (
            <Panel title="Capacity and availability">
              <Row className="g-3">
                <Col sm={5}>
                  <Form.Label>Maximum active mentees</Form.Label>
                  <Form.Control
                    type="number" min={1} max={10} value={form.max_active_mentees}
                    onChange={setField('max_active_mentees')}
                    isInvalid={Boolean(fieldError('max_active_mentees'))}
                  />
                  <Form.Control.Feedback type="invalid">{fieldError('max_active_mentees')}</Form.Control.Feedback>
                  <Form.Text className="text-muted">1–10. Cannot be lower than your current {activeMentees} active mentee{activeMentees === 1 ? '' : 's'}.</Form.Text>
                </Col>
                <Col sm={7}>
                  <Form.Label>New requests</Form.Label>
                  <Form.Check
                    type="switch"
                    id="profile-accepting"
                    label="Accepting new mentee requests"
                    checked={form.is_available}
                    onChange={(event) => setForm((current) => ({ ...current, is_available: event.target.checked }))}
                  />
                  <div className="policy-note mt-2">
                    Pausing stops new requests but keeps existing mentorships and published slots. Availability
                    slots are managed on the Schedule page.
                  </div>
                </Col>
              </Row>
            </Panel>
          )}

          {tab === 'account' && (
            <Panel title="Change password">
              <p className="text-muted small">Presentation only. No password is stored or changed, and no other device is signed out.</p>
              <PasswordForm />
            </Panel>
          )}
        </Col>

        <Col lg={4}>
          <Panel title="Review status">
            <div className="d-flex justify-content-between py-1"><span className="text-muted">Status</span><StatusBadge status={status} /></div>
            <div className="d-flex justify-content-between py-1"><span className="text-muted">Submitted</span><span>{me?.reviewed_at ? fmtDate(me.reviewed_at) : '—'}</span></div>
            <div className="d-flex justify-content-between py-1"><span className="text-muted">Active mentees</span><span>{activeMentees} / {form.max_active_mentees}</span></div>
            <div className="policy-note mt-3">
              {status === 'approved'
                ? 'Approved in the local demo. Profile edits are saved only in this browser.'
                : status === 'pending_review'
                  ? 'Waiting for an administrator. You can keep editing while the review is queued.'
                  : 'Complete the required fields, then submit for review. Students cannot see unapproved profiles.'}
            </div>
          </Panel>

          <Panel title="Profile checklist" className="mt-3">
            <ul className="list-unstyled small mb-0">
              {[
                ['Professional title', form.professional_title.trim()],
                ['Organisation', form.organisation.trim()],
                ['Experience', form.experience_years !== ''],
                ['Bio', form.bio.trim()],
                ['Expertise', expertise.length > 0],
                ['Career pathway', interestIds.length > 0],
              ].map(([label, done]) => (
                <li key={label} className="d-flex justify-content-between py-1">
                  <span className="text-muted">{label}</span>
                  <span className={done ? 'text-success' : 'text-danger'}>{done ? '✓' : '—'}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== page 21 */

export function MentorNotifications() {
  return <NotificationsPage audience="mentor" />;
}
