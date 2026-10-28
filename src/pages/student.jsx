import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getAll, get, patch, post } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/toast.jsx';
import {
  ApiErrorBanner, Chip, DataTable, EmptyState, ErrorState, Loading, PageHeader, Pager, Panel,
  STAGES, STAGE_LABEL, LEVELS, LEVEL_LABEL, Stars, StatusBadge, Tabs, StatCard, useApi, useTitle,
  fmtDate, fmtDateTime, fmtTime, fmtDay, timeAgo, untilText, toDateInput, combineLocal, initials,
} from '../components/ui.jsx';
import {
  BookingDialog, ConfirmDialog, FeedbackDialog, ReasonDialog, RequestDrawer,
} from '../components/dialogs.jsx';
import { InterestPicker, PasswordForm, SkillPicker } from '../components/editors.jsx';

/* ------------------------------------------------------------------ shared bits */

function MentorCard({ mentor, match, onView }) {
  const navigate = useNavigate();
  const score = match?.match_score;
  return (
    <div className="card-soft mentor-card">
      <div className="card-body">
        <div className="d-flex gap-2 align-items-start">
          <div className="avatar">{initials(mentor.full_name)}</div>
          <div className="flex-grow-1 min-w-0">
            <div className="mentor-name">{mentor.full_name}</div>
            <div className="mentor-title">
              {mentor.professional_title}
              {mentor.organisation ? ` · ${mentor.organisation}` : ''}
            </div>
            <div className="small text-muted mt-1">
              {mentor.experience_years != null ? `${mentor.experience_years} years' experience` : 'Experience not stated'}
              {' · '}
              {mentor.mentor_type === 'recent_graduate' ? 'Recent graduate' : 'Alumni'}
            </div>
          </div>
          {score != null && <span className="score-pill" title="Rule-based match score, 0–100">{Math.round(score)}</span>}
        </div>

        <div className="mt-2">
          {(mentor.top_skills || []).slice(0, 4).map((skill) => <Chip key={skill}>{skill}</Chip>)}
        </div>

        {match?.reasons?.length > 0 && (
          <ul className="small text-muted ps-3 mb-0 mt-1">
            {match.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}

        <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
          {mentor.accepting_mentees ? (
            <span className="status-badge status-accepted">Accepting mentees</span>
          ) : (
            <span className="status-badge status-cancelled">Not accepting</span>
          )}
          {mentor.open_slots_14d != null && (
            <span className="small text-muted">{mentor.open_slots_14d} open slot{mentor.open_slots_14d === 1 ? '' : 's'} in 14 days</span>
          )}
        </div>

        <div className="mentor-foot">
          <Button size="sm" variant="outline-primary" onClick={() => (onView ? onView(mentor) : navigate(`/student/mentors/${mentor.mentor_id}`))}>
            View profile
          </Button>
          {mentor.accepting_mentees && (
            <Button size="sm" variant="primary" onClick={() => navigate(`/student/mentors/${mentor.mentor_id}/request`)}>
              Request mentoring
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CountTabs({ tabs, active, onChange }) {
  return <Tabs tabs={tabs} active={active} onChange={onChange} />;
}

/* ================================================================== page 5 */

const EMPTY_FORM = {
  programme_stage: '',
  expected_graduation_year: '',
  bio: '',
  career_goals: '',
  guidance_needs: '',
};

export function StudentOnboarding() {
  useTitle('Profile setup');
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const profile = useApi(() => get('/students/me/profile'), []);
  const skillsCatalogue = useApi(() => getAll('/skills'), []);
  const interestsCatalogue = useApi(() => getAll('/career-interests'), []);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [skills, setSkills] = useState([]);
  const [interestIds, setInterestIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!profile.data || initialised) return;
    const p = profile.data.data;
    setForm({
      programme_stage: p.programme_stage || '',
      expected_graduation_year: p.expected_graduation_year || '',
      bio: p.bio || '',
      career_goals: p.career_goals || '',
      guidance_needs: p.guidance_needs || '',
    });
    setSkills((p.skills || []).map((skill) => ({ ...skill })));
    setInterestIds((p.interests || []).map((interest) => interest.interest_id));
    setInitialised(true);
  }, [profile.data, initialised]);

  const stageComplete = Boolean(form.programme_stage);
  const skillCount = skills.length;
  const canFinish = stageComplete
    && form.career_goals.trim().length > 0
    && interestIds.length > 0;

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const saveStepOne = async () => {
    if (!form.programme_stage) {
      setError({ message: 'Choose your programme stage to continue.' });
      return false;
    }
    await patch('/students/me/profile', {
      programme_stage: form.programme_stage,
      expected_graduation_year: form.expected_graduation_year ? Number(form.expected_graduation_year) : null,
      bio: form.bio.trim() || null,
    });
    return true;
  };

  const saveStepTwo = async () => {
    await patch('/students/me/profile', {
      skills: skills.map((skill) => ({
        skill_id: skill.skill_id,
        proficiency_level: skill.proficiency_level,
        is_focus: Boolean(skill.is_focus),
      })),
    });
    return true;
  };

  const advance = async () => {
    setBusy(true);
    setError(null);
    try {
      if (step === 1) await saveStepOne();
      if (step === 2) await saveStepTwo();
      setStep((current) => Math.min(3, current + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!form.career_goals.trim()) {
      setError({ message: 'Career goals are required to finish onboarding.' });
      return;
    }
    if (interestIds.length === 0) {
      setError({ message: 'Choose at least one career interest to finish onboarding.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patch('/students/me/profile', {
        programme_stage: form.programme_stage,
        expected_graduation_year: form.expected_graduation_year ? Number(form.expected_graduation_year) : null,
        bio: form.bio.trim() || null,
        career_goals: form.career_goals.trim(),
        guidance_needs: form.guidance_needs.trim() || null,
        skills: skills.map((skill) => ({
          skill_id: skill.skill_id,
          proficiency_level: skill.proficiency_level,
          is_focus: Boolean(skill.is_focus),
        })),
        interest_ids: interestIds,
      });
      await refreshUser().catch(() => {});
      toast.success('Your profile is complete. Here are your recommendations.');
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (profile.loading || !initialised) {
    return (
      <>
        <PageHeader title="Set up your profile" subtitle="Three short steps so mentors and matching understand your goals." />
        <Panel><Loading label="Loading your profile…" rows={5} /></Panel>
      </>
    );
  }
  if (profile.error) {
    return <ErrorState error={profile.error} onRetry={profile.reload} />;
  }

  return (
    <>
      <PageHeader
        title="Set up your profile"
        subtitle="This information powers recommendations and is shared with mentors you contact."
        actions={<Link to="/student/dashboard" className="btn btn-outline-secondary btn-sm">Skip for now</Link>}
      />

      {error && <ApiErrorBanner error={error} />}
      {profile.data?.data?.profile_completed && (
        <Alert variant="success" className="py-2 small">
          Your profile is complete. You can update any step below.
        </Alert>
      )}

      <div className="stepper">
        {[
          [1, 'About you'],
          [2, 'Skills'],
          [3, 'Interests and goals'],
        ].map(([number, label]) => (
          <button
            key={number}
            type="button"
            className={`step-pill ${step === number ? 'active' : step > number ? 'done' : ''}`}
            onClick={() => { if (number < step) setStep(number); }}
            disabled={number > step}
          >
            <span className="num">{step > number ? '✓' : number}</span>
            {label}
          </button>
        ))}
      </div>

      <Row className="g-3">
        <Col lg={8}>
          <Panel>
            {step === 1 && (
              <Form>
                <Row className="g-3">
                  <Col sm={7}>
                    <Form.Label>Programme stage <span className="text-danger">*</span></Form.Label>
                    <Form.Select value={form.programme_stage} onChange={setField('programme_stage')} required>
                      <option value="">Select your stage</option>
                      {STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Form.Select>
                  </Col>
                  <Col sm={5}>
                    <Form.Label>Expected graduation year</Form.Label>
                    <Form.Control
                      type="number" min={2024} max={2100} value={form.expected_graduation_year}
                      onChange={setField('expected_graduation_year')} placeholder="e.g. 2027"
                    />
                  </Col>
                  <Col xs={12}>
                    <Form.Label>About you <span className="text-muted fw-normal">(optional)</span></Form.Label>
                    <Form.Control
                      as="textarea" rows={4} maxLength={1000} value={form.bio} onChange={setField('bio')}
                      placeholder="A short introduction: your background, interests and what you hope to get from mentoring."
                    />
                    <div className="char-count text-end">{form.bio.length} / 1000</div>
                  </Col>
                </Row>
              </Form>
            )}

            {step === 2 && (
              <>
                <p className="text-muted small">
                  Add the skills you want to develop. Mark up to five as focus skills — matching weights them highest.
                </p>
                {skillsCatalogue.loading && <Loading label="Loading the skill catalogue…" rows={2} />}
                {skillsCatalogue.error && <ErrorState error={skillsCatalogue.error} onRetry={skillsCatalogue.reload} />}
                {!skillsCatalogue.loading && !skillsCatalogue.error && (skillsCatalogue.data || []).length === 0 && (
                  <EmptyState icon="◌" title="No skills available yet">
                    Please contact the programme office.
                  </EmptyState>
                )}
                <SkillPicker catalogue={skillsCatalogue.data || []} selected={skills} onChange={setSkills} />
              </>
            )}

            {step === 3 && (
              <Form>
                <Form.Group className="mb-4">
                  <Form.Label>Career interests <span className="text-danger">*</span></Form.Label>
                  <p className="text-muted small">Choose the pathways you want advice on.</p>
                  {interestsCatalogue.loading && <Loading label="Loading career interests…" rows={2} />}
                  {interestsCatalogue.error && <ErrorState error={interestsCatalogue.error} onRetry={interestsCatalogue.reload} />}
                  <InterestPicker
                    catalogue={interestsCatalogue.data || []}
                    selectedIds={interestIds}
                    onChange={setInterestIds}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Career goals <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    as="textarea" rows={4} maxLength={2000} value={form.career_goals} onChange={setField('career_goals')}
                    placeholder="What do you want to achieve? e.g. move into a data science role, prepare for higher studies, build a portfolio."
                  />
                  <div className="char-count text-end">{form.career_goals.length} / 2000</div>
                </Form.Group>

                <Form.Group>
                  <Form.Label>Guidance needs <span className="text-muted fw-normal">(optional)</span></Form.Label>
                  <Form.Control
                    as="textarea" rows={3} maxLength={2000} value={form.guidance_needs} onChange={setField('guidance_needs')}
                    placeholder="e.g. project reviews, interview preparation, course selection."
                  />
                  <div className="char-count text-end">{form.guidance_needs.length} / 2000</div>
                </Form.Group>
              </Form>
            )}
          </Panel>
        </Col>

        <Col lg={4}>
          <Panel title="Your progress">
            <ul className="list-unstyled small mb-0">
              <li className="d-flex justify-content-between py-1">
                <span className="text-muted">Programme stage</span>
                <span className="fw-semibold">{form.programme_stage ? STAGE_LABEL[form.programme_stage] : 'Not set'}</span>
              </li>
              <li className="d-flex justify-content-between py-1">
                <span className="text-muted">Skills</span>
                <span className="fw-semibold">{skillCount}</span>
              </li>
              <li className="d-flex justify-content-between py-1">
                <span className="text-muted">Focus skills</span>
                <span className="fw-semibold">{skills.filter((skill) => skill.is_focus).length} / 5</span>
              </li>
              <li className="d-flex justify-content-between py-1">
                <span className="text-muted">Career interests</span>
                <span className="fw-semibold">{interestIds.length}</span>
              </li>
              <li className="d-flex justify-content-between py-1">
                <span className="text-muted">Career goals</span>
                <span className="fw-semibold">{form.career_goals.trim() ? 'Added' : 'Missing'}</span>
              </li>
            </ul>
            <div className="policy-note mt-3">
              You can change all of this later from <Link to="/student/profile">your profile</Link>. Requests need a
              complete profile, so finish the three steps before contacting mentors.
            </div>
          </Panel>
        </Col>
      </Row>

      <div className="d-flex justify-content-between mt-3">
        <Button
          variant="outline-secondary"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          disabled={step === 1 || busy}
        >
          Back
        </Button>
        <div className="d-flex gap-2">
          {step < 3 && (
            <Button variant="primary" onClick={advance} disabled={busy}>
              {busy && <Spinner animation="border" size="sm" className="me-2" />}
              Save and continue
            </Button>
          )}
          {step === 3 && (
            <Button variant="primary" onClick={finish} disabled={busy || !canFinish}>
              {busy && <Spinner animation="border" size="sm" className="me-2" />}
              Finish setup
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================== page 6 */

export function StudentDashboard() {
  useTitle('Student dashboard');
  const { user } = useAuth();
  const dash = useApi(() => get('/students/me/dashboard'), []);
  const recs = useApi(() => get('/mentors/recommended', { page_size: 3 }), []);
  const requests = useApi(() => get('/mentoring-requests/mine', { page_size: 3 }), []);
  const notifications = useApi(() => get('/notifications', { page_size: 3 }), []);

  const data = dash.data?.data;
  const nextSession = data?.next_session;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'there'}`}
        subtitle="Your requests, mentorship and next session at a glance."
        actions={<Link to="/student/mentors" className="btn btn-primary">Find a mentor</Link>}
      />

      {!dash.loading && data && !data.profile_completed && (
        <Alert variant="warning" className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Your profile is incomplete.</strong> Add your programme stage, career goals and interests so
            matching can rank mentors for you.
          </div>
          <Link to="/student/onboarding" className="btn btn-sm btn-primary">Complete profile</Link>
        </Alert>
      )}

      {dash.error && <ApiErrorBanner error={dash.error} onRetry={dash.reload} />}

      <Row className="g-3 mb-3">
        <Col sm={6} xl={3}>
          <StatCard label="Pending requests" value={dash.loading ? '—' : data?.pending_requests ?? 0} to="/student/requests" hint="Awaiting a mentor decision" />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard label="Active mentorships" value={dash.loading ? '—' : data?.active_mentorships ?? 0} to="/student/mentorships" hint="Ongoing relationships" />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard
            label="Next session"
            value={nextSession ? fmtDate(nextSession.scheduled_start) : 'None'}
            hint={nextSession ? `${fmtTime(nextSession.scheduled_start)} · ${nextSession.mentor_name || 'Mentor'}` : 'Book from a mentorship'}
            to={nextSession ? `/student/mentorships/${nextSession.mentorship_id}/sessions` : '/student/mentorships'}
          />
        </Col>
        <Col sm={6} xl={3}>
          <StatCard label="Unread notifications" value={dash.loading ? '—' : data?.unread_notifications ?? 0} to="/student/notifications" hint="Requests, sessions and feedback" />
        </Col>
      </Row>

      <Row className="g-3">
        <Col xl={8}>
          <Panel
            title="Recommended mentors"
            subtitle="Ranked from your focus skills, interests and mentor availability."
            actions={<Link to="/student/mentors" className="btn btn-sm btn-outline-primary">See all</Link>}
          >
            {recs.loading && <Loading label="Scoring mentors…" rows={3} />}
            {recs.error && recs.error.code === 'PROFILE_INCOMPLETE' && (
              <EmptyState icon="◎" title="Complete your profile first" action={<Link to="/student/onboarding" className="btn btn-primary btn-sm">Complete profile</Link>}>
                Recommendations need your programme stage, career goals and at least one interest.
              </EmptyState>
            )}
            {recs.error && recs.error.code !== 'PROFILE_INCOMPLETE' && (
              <ErrorState error={recs.error} onRetry={recs.reload} />
            )}
            {!recs.loading && !recs.error && (recs.data?.data || []).length === 0 && (
              <EmptyState icon="◌" title="No eligible mentors yet">
                Add more skills or interests, or check back when mentors publish availability.
              </EmptyState>
            )}
            <Row className="g-3">
              {(recs.data?.data || []).map((item) => (
                <Col md={12} lg={4} key={item.mentor.mentor_id}>
                  <MentorCard mentor={item.mentor} match={item} />
                </Col>
              ))}
            </Row>
          </Panel>

          <Panel
            title="My requests"
            className="mt-3"
            actions={<Link to="/student/requests" className="btn btn-sm btn-outline-primary">View my requests</Link>}
          >
            {requests.loading && <Loading label="Loading requests…" rows={2} />}
            {requests.error && <ErrorState error={requests.error} onRetry={requests.reload} />}
            {!requests.loading && !requests.error && (requests.data?.data || []).length === 0 && (
              <EmptyState icon="✉" title="No requests yet" action={<Link to="/student/mentors" className="btn btn-sm btn-primary">Find a mentor</Link>}>
                Send a goal-based request to start a mentorship.
              </EmptyState>
            )}
            <div className="list-tight">
              {(requests.data?.data || []).map((request) => (
                <div key={request.request_id} className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                  <div>
                    <div className="fw-semibold">{request.mentor_name}</div>
                    <div className="small text-muted text-truncate" style={{ maxWidth: '52ch' }}>{request.career_goal}</div>
                    <div className="small text-muted">Sent {timeAgo(request.created_at)} · {untilText(request.expires_at)}</div>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              ))}
            </div>
          </Panel>
        </Col>

        <Col xl={4}>
          <Panel
            title="Next session"
            actions={nextSession ? <Link to={`/student/mentorships/${nextSession.mentorship_id}/sessions`} className="btn btn-sm btn-outline-primary">Open</Link> : null}
          >
            {!nextSession && (
              <EmptyState icon="◷" title="Nothing scheduled">
                Book a session from an active mentorship.
              </EmptyState>
            )}
            {nextSession && (
              <div>
                <div className="fw-semibold mb-1">{fmtDateTime(nextSession.scheduled_start)}</div>
                <div className="small text-muted mb-2">with {nextSession.mentor_name}</div>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <StatusBadge status={nextSession.status} />
                  <span className="small text-muted text-capitalize">{nextSession.meeting_mode.replace('_', ' ')}</span>
                </div>
                {nextSession.meeting_link && (
                  <a className="btn btn-sm btn-teal mt-3" aria-disabled="true" title="Presentation only: external meetings are disabled in this demo.">
                    Join meeting (demo only)
                  </a>
                )}
                {nextSession.notes && <div className="note-box mt-3">{nextSession.notes}</div>}
              </div>
            )}
          </Panel>

          <Panel
            title="Notifications"
            className="mt-3"
            actions={<Link to="/student/notifications" className="btn btn-sm btn-outline-primary">View all</Link>}
          >
            {notifications.loading && <Loading label="Loading notifications…" rows={2} />}
            {notifications.error && <ErrorState error={notifications.error} onRetry={notifications.reload} />}
            {!notifications.loading && !notifications.error && (notifications.data?.data || []).length === 0 && (
              <EmptyState icon="◔" title="Nothing new" />
            )}
            <div className="list-tight">
              {(notifications.data?.data || []).map((item) => (
                <div key={item.notification_id}>
                  <div className={`small ${item.is_read ? 'text-muted' : 'fw-semibold'}`}>{item.title}</div>
                  <div className="small text-muted">{item.message}</div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>{timeAgo(item.created_at)}</div>
                </div>
              ))}
            </div>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== page 7 */

export function MentorDirectory() {
  useTitle('Find mentors');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'all' ? 'all' : 'recommended');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    q: '', skill_id: '', interest_id: '', mentor_type: '', min_experience: '', accepting: true, sort: 'newest',
  });
  const [applied, setApplied] = useState(filters);

  const skillsCatalogue = useApi(() => getAll('/skills'), []);
  const interestsCatalogue = useApi(() => getAll('/career-interests'), []);

  const recommended = useApi(
    () => get('/mentors/recommended', { page, page_size: pageSize }),
    [page, pageSize, tab],
    { immediate: tab === 'recommended' },
  );
  const directory = useApi(
    () => get('/mentors', {
      page,
      page_size: pageSize,
      q: applied.q || undefined,
      skill_id: applied.skill_id || undefined,
      interest_id: applied.interest_id || undefined,
      mentor_type: applied.mentor_type || undefined,
      min_experience: applied.min_experience || undefined,
      accepting: applied.accepting,
      sort: applied.sort,
    }),
    [page, pageSize, tab, applied],
    { immediate: tab === 'all' },
  );

  const switchTab = (next) => {
    setTab(next);
    setPage(1);
    setParams(next === 'all' ? { tab: 'all' } : {}, { replace: true });
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setApplied({ ...filters });
    setPage(1);
  };
  const clearFilters = () => {
    const blank = { q: '', skill_id: '', interest_id: '', mentor_type: '', min_experience: '', accepting: true, sort: 'newest' };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  };

  const active = tab === 'recommended' ? recommended : directory;
  const rows = active.data?.data || [];
  const meta = active.data?.meta;

  return (
    <>
      <PageHeader
        title="Find a mentor"
        subtitle="Start with recommendations scored against your profile, or search the whole approved directory."
      />

      <Tabs
        active={tab}
        onChange={switchTab}
        tabs={[
          { key: 'recommended', label: 'Recommended' },
          { key: 'all', label: 'All mentors' },
        ]}
      />

      {tab === 'all' && (
        <Panel className="mb-3">
          <Form onSubmit={applyFilters}>
            <Row className="g-2 align-items-end">
              <Col md={4}>
                <Form.Label>Keyword</Form.Label>
                <Form.Control
                  size="sm" placeholder="Title, organisation or bio"
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                />
              </Col>
              <Col sm={6} md={2}>
                <Form.Label>Skill</Form.Label>
                <Form.Select
                  size="sm" value={filters.skill_id}
                  onChange={(event) => setFilters((current) => ({ ...current, skill_id: event.target.value }))}
                >
                  <option value="">Any skill</option>
                  {(skillsCatalogue.data || []).map((skill) => (
                    <option key={skill.skill_id} value={skill.skill_id}>{skill.skill_name}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} md={2}>
                <Form.Label>Career pathway</Form.Label>
                <Form.Select
                  size="sm" value={filters.interest_id}
                  onChange={(event) => setFilters((current) => ({ ...current, interest_id: event.target.value }))}
                >
                  <option value="">Any pathway</option>
                  {(interestsCatalogue.data || []).map((interest) => (
                    <option key={interest.interest_id} value={interest.interest_id}>{interest.interest_name}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} md={2}>
                <Form.Label>Mentor type</Form.Label>
                <Form.Select
                  size="sm" value={filters.mentor_type}
                  onChange={(event) => setFilters((current) => ({ ...current, mentor_type: event.target.value }))}
                >
                  <option value="">Any type</option>
                  <option value="alumni">Alumni</option>
                  <option value="recent_graduate">Recent graduate</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={1}>
                <Form.Label>Min. years</Form.Label>
                <Form.Control
                  size="sm" type="number" min={0} max={60} value={filters.min_experience}
                  onChange={(event) => setFilters((current) => ({ ...current, min_experience: event.target.value }))}
                />
              </Col>
              <Col xs={6} md={1}>
                <Form.Label>Sort</Form.Label>
                <Form.Select
                  size="sm" value={filters.sort}
                  onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}
                >
                  <option value="newest">Newest</option>
                  <option value="experience">Experience</option>
                  <option value="name">Name</option>
                </Form.Select>
              </Col>
              <Col xs={12} className="d-flex flex-wrap gap-3 align-items-center mt-2">
                <Form.Check
                  type="switch" id="accepting-filter" label="Only mentors accepting mentees"
                  checked={filters.accepting}
                  onChange={(event) => setFilters((current) => ({ ...current, accepting: event.target.checked }))}
                />
                <Button size="sm" type="submit" variant="primary">Apply filters</Button>
                <Button size="sm" type="button" variant="outline-secondary" onClick={clearFilters}>Clear filters</Button>
              </Col>
            </Row>
          </Form>
        </Panel>
      )}

      {active.loading && <Loading label="Loading mentors…" rows={5} />}

      {recommended.error?.code === 'PROFILE_INCOMPLETE' && tab === 'recommended' && (
        <Alert variant="warning" className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div><strong>Complete your profile to see recommendations.</strong> We need your stage, goals and at least one interest.</div>
          <Link to="/student/onboarding" className="btn btn-sm btn-primary">Complete profile</Link>
        </Alert>
      )}

      {active.error && active.error.code !== 'PROFILE_INCOMPLETE' && (
        <ErrorState error={active.error} onRetry={active.reload} />
      )}

      {!active.loading && !active.error && rows.length === 0 && (
        <Panel>
          <EmptyState
            icon="◌"
            title={tab === 'recommended' ? 'No eligible mentors yet' : 'No mentors match your filters'}
            action={tab === 'all'
              ? <Button size="sm" variant="outline-primary" onClick={clearFilters}>Clear filters</Button>
              : <Link to="/student/onboarding" className="btn btn-sm btn-primary">Review your profile</Link>}
          >
            {tab === 'recommended'
              ? 'Broaden your interests or add more focus skills, then try again.'
              : 'Try a different keyword or remove some filters.'}
          </EmptyState>
        </Panel>
      )}

      {rows.length > 0 && (
        <>
          <Row className="g-3">
            {tab === 'recommended' && rows.map((item) => (
              <Col md={6} xl={4} key={item.mentor.mentor_id}>
                <MentorCard mentor={item.mentor} match={item} />
              </Col>
            ))}
            {tab === 'all' && rows.map((mentor) => (
              <Col md={6} xl={4} key={mentor.mentor_id}>
                <MentorCard mentor={mentor} />
              </Col>
            ))}
          </Row>
          <Pager meta={meta} onPage={(next) => setPage(next)} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}

      {tab === 'recommended' && rows.length > 0 && (
        <p className="small text-muted mt-3 mb-0">
          Match scores are a transparent rule-based ranking (0–100), not a probability. Hover a card's score for the breakdown.
        </p>
      )}
    </>
  );
}

/* ================================================================== page 8 */

export function MentorDetail() {
  useTitle('Mentor profile');
  const { mentor_id: mentorId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mentor = useApi(() => get(`/mentors/${mentorId}`), [mentorId]);
  const requests = useApi(() => getAll('/mentoring-requests/mine'), [mentorId]);
  const mentorships = useApi(() => getAll('/mentorships'), [mentorId]);

  const data = mentor.data?.data;

  const eligibility = useMemo(() => {
    if (!data) return { allowed: false, reason: '' };
    if (!user?.profile_completed) {
      return { allowed: false, reason: 'Complete your profile before sending a request.', link: '/student/onboarding', linkLabel: 'Complete profile' };
    }
    const active = (mentorships.data || []).find((row) => row.mentor_id === mentorId && row.status === 'active');
    if (active) {
      return { allowed: false, reason: 'You already have an active mentorship with this mentor.', link: `/student/mentorships/${active.mentorship_id}`, linkLabel: 'Open mentorship' };
    }
    const pending = (requests.data || []).find((row) => row.mentor_id === mentorId && row.status === 'pending');
    if (pending) {
      return { allowed: false, reason: 'You have a pending request with this mentor.', link: '/student/requests', linkLabel: 'View request' };
    }
    const declined = (requests.data || [])
      .filter((row) => row.mentor_id === mentorId && row.status === 'declined' && row.responded_at)
      .sort((a, b) => new Date(b.responded_at) - new Date(a.responded_at))[0];
    if (declined) {
      const retry = new Date(new Date(declined.responded_at).getTime() + 14 * 86_400_000);
      if (retry > new Date()) {
        return { allowed: false, reason: `This mentor declined a recent request. You can ask again after ${fmtDate(retry)}.` };
      }
    }
    if (!data.is_available) {
      return { allowed: false, reason: 'This mentor has paused new requests.' };
    }
    if ((data.free_mentee_spots ?? 0) <= 0) {
      return { allowed: false, reason: 'This mentor is at capacity right now.' };
    }
    return { allowed: true, reason: '' };
  }, [data, requests.data, mentorships.data, mentorId, user]);

  if (mentor.loading) return <Loading label="Loading mentor profile…" rows={6} />;
  if (mentor.error) {
    return (
      <>
        <PageHeader title="Mentor profile" actions={<Link to="/student/mentors" className="btn btn-outline-secondary btn-sm">Back to results</Link>} />
        {mentor.error.code === 'NOT_FOUND'
          ? <EmptyState icon="◌" title="This mentor is not available">The profile may have been removed or is not approved.</EmptyState>
          : <ErrorState error={mentor.error} onRetry={mentor.reload} />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={data.full_name}
        subtitle={`${data.professional_title || 'Mentor'}${data.organisation ? ` · ${data.organisation}` : ''}`}
        actions={(
          <>
            <Button variant="outline-secondary" onClick={() => navigate(-1)}>Back to results</Button>
            {eligibility.allowed ? (
              <Button variant="primary" onClick={() => navigate(`/student/mentors/${mentorId}/request`)}>Request mentoring</Button>
            ) : eligibility.link ? (
              <Link to={eligibility.link} className="btn btn-outline-primary">{eligibility.linkLabel}</Link>
            ) : null}
          </>
        )}
      />

      {!eligibility.allowed && !eligibility.link && (
        <Alert variant="info" className="py-2 small">{eligibility.reason}</Alert>
      )}

      <Row className="g-3">
        <Col lg={8}>
          <Panel>
            <div className="d-flex flex-wrap gap-3 align-items-start">
              <div className="avatar" style={{ width: 64, height: 64, fontSize: '1.2rem' }}>{initials(data.full_name)}</div>
              <div className="flex-grow-1">
                <h2 className="h5 mb-1">{data.full_name}</h2>
                <div className="text-muted">{data.professional_title}{data.organisation ? ` · ${data.organisation}` : ''}</div>
                <div className="small text-muted mt-1">
                  {data.experience_years != null && `${data.experience_years} years' experience`}
                  {data.graduation_year && ` · Graduated ${data.graduation_year}`}
                  {' · '}{data.mentor_type === 'recent_graduate' ? 'Recent graduate' : 'Alumni'}
                </div>
                <div className="mt-2 d-flex flex-wrap gap-2 align-items-center">
                  {data.is_available ? <StatusBadge status="accepted" label="Accepting mentees" /> : <StatusBadge status="cancelled" label="Paused" />}
                  {(data.open_slots_14d ?? 0) > 0 && <Chip>{data.open_slots_14d} open slot{data.open_slots_14d === 1 ? '' : 's'} in 14 days</Chip>}
                  <Chip>{data.free_mentee_spots} mentee spot{data.free_mentee_spots === 1 ? '' : 's'} free</Chip>
                </div>
              </div>
              {data.rating ? (
                <div className="text-end">
                  <Stars value={data.rating.average} count={data.rating.count} />
                </div>
              ) : (
                <span className="small text-muted">Not enough ratings yet</span>
              )}
            </div>

            <hr />
            <h3 className="section-title mb-2">About</h3>
            <p className="mb-0">{data.bio || 'This mentor has not added a bio yet.'}</p>

            <h3 className="section-title mt-4 mb-2">Expertise</h3>
            <div>
              {(data.expertise || []).map((skill) => (
                <Chip key={skill.skill_id}>{skill.skill_name} · {LEVEL_LABEL[skill.expertise_level] || skill.expertise_level}</Chip>
              ))}
              {(data.expertise || []).length === 0 && <span className="text-muted small">No expertise listed yet.</span>}
            </div>

            <h3 className="section-title mt-4 mb-2">Career pathways</h3>
            <div>
              {(data.interests || []).map((interest) => <Chip key={interest.interest_id}>{interest.interest_name}</Chip>)}
              {(data.interests || []).length === 0 && <span className="text-muted small">No pathways listed yet.</span>}
            </div>

            {data.linkedin_url && (
              <p className="small mt-4 mb-0">
                <a aria-disabled="true" title="Presentation only: external profiles are disabled in this demo.">Professional profile (demo only)</a>
              </p>
            )}
          </Panel>
        </Col>

        <Col lg={4}>
          <Panel title="Availability and capacity">
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Open slots (14 days)</span>
              <span className="fw-semibold">{data.open_slots_14d ?? 0}</span>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Free mentee spots</span>
              <span className="fw-semibold">{data.free_mentee_spots ?? 0}</span>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Capacity</span>
              <span className="fw-semibold">{data.max_active_mentees ?? '—'} mentees</span>
            </div>
            <div className="policy-note mt-3">
              Exact slot times become visible once a mentorship is active. Availability counts are a guide only.
            </div>
            <div className="mt-3 d-grid gap-2">
              {eligibility.allowed ? (
                <Button onClick={() => navigate(`/student/mentors/${mentorId}/request`)}>Request mentoring</Button>
              ) : (
                <Button variant="outline-secondary" disabled>Request mentoring</Button>
              )}
              {!eligibility.allowed && <div className="small text-muted">{eligibility.reason}</div>}
            </div>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== page 9 */

export function SendRequest() {
  useTitle('Send mentoring request');
  const { mentor_id: mentorId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const mentor = useApi(() => get(`/mentors/${mentorId}`), [mentorId]);
  const profile = useApi(() => get('/students/me/profile'), [mentorId]);
  const [careerGoal, setCareerGoal] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const data = mentor.data?.data;
  const student = profile.data?.data;

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (careerGoal.trim().length < 20) errors.career_goal = 'Describe your goal in at least 20 characters.';
    if (careerGoal.length > 1000) errors.career_goal = 'Keep the goal to 1000 characters.';
    if (message.length > 1500) errors.message = 'Keep the message to 1500 characters.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      await post('/mentoring-requests', {
        mentor_id: mentorId,
        career_goal: careerGoal.trim(),
        message: message.trim() || null,
      });
      toast.success(`Request sent to ${data?.full_name || 'your mentor'}.`);
      navigate('/student/requests');
    } catch (err) {
      const mapped = {};
      (err.details || []).forEach((detail) => {
        const field = String(detail.field || '').split('.').pop();
        if (field === 'career_goal' || field === 'message') mapped[field] = detail.issue;
      });
      setFieldErrors(mapped);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (mentor.loading || profile.loading) return <Loading label="Loading request form…" rows={5} />;
  if (mentor.error) return <ErrorState error={mentor.error} onRetry={mentor.reload} />;

  const blocking = error && !fieldErrors.career_goal && !fieldErrors.message ? error : null;

  return (
    <>
      <PageHeader
        title="Send a mentoring request"
        subtitle="One request, one mentor. The mentor sees the profile summary below."
        actions={<Button variant="outline-secondary" onClick={() => navigate(`/student/mentors/${mentorId}`)}>Cancel</Button>}
      />

      {blocking && (
        <Alert variant="warning" className="py-2">
          <div className="fw-semibold">{blocking.code.replaceAll('_', ' ').toLowerCase()}</div>
          <div>{blocking.message}</div>
          {blocking.code === 'PROFILE_INCOMPLETE' && <Link to="/student/onboarding" className="alert-link">Complete your profile</Link>}
          {(blocking.code === 'DUPLICATE_PENDING_REQUEST' || blocking.code === 'REQUEST_COOLDOWN') && (
            <Link to="/student/requests" className="alert-link ms-1">View my requests</Link>
          )}
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={7}>
          <Panel title={`Request to ${data.full_name}`}>
            <div className="note-box mb-3">
              <div className="fw-semibold">{data.professional_title}</div>
              <div className="small text-muted">{data.organisation}</div>
              <div className="small text-muted mt-1">
                {data.free_mentee_spots} spot{data.free_mentee_spots === 1 ? '' : 's'} free · {data.open_slots_14d} open slot{data.open_slots_14d === 1 ? '' : 's'} in 14 days
              </div>
            </div>

            <Form onSubmit={submit} noValidate>
              <Form.Group className="mb-3">
                <Form.Label>Career goal <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  as="textarea" rows={4} value={careerGoal} maxLength={1000}
                  onChange={(event) => { setCareerGoal(event.target.value); setFieldErrors((current) => ({ ...current, career_goal: undefined })); }}
                  isInvalid={Boolean(fieldErrors.career_goal)}
                  placeholder="What do you want to achieve through this mentorship? Be specific — 20 to 1000 characters."
                  required
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.career_goal}</Form.Control.Feedback>
                <div className={`char-count text-end ${careerGoal.length > 1000 ? 'over' : ''}`}>{careerGoal.length} / 1000</div>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Message <span className="text-muted fw-normal">(optional)</span></Form.Label>
                <Form.Control
                  as="textarea" rows={4} value={message} maxLength={1500}
                  onChange={(event) => { setMessage(event.target.value); setFieldErrors((current) => ({ ...current, message: undefined })); }}
                  isInvalid={Boolean(fieldErrors.message)}
                  placeholder="Introduce yourself and explain why this mentor's background fits."
                />
                <Form.Control.Feedback type="invalid">{fieldErrors.message}</Form.Control.Feedback>
                <div className={`char-count text-end ${message.length > 1500 ? 'over' : ''}`}>{message.length} / 1500</div>
              </Form.Group>

              <div className="policy-note mb-3">
                Requests expire after 14 days. You can have at most three pending requests. A declined request
                starts a 14-day cooldown before you can ask the same mentor again.
              </div>

              <div className="d-flex gap-2">
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy && <Spinner animation="border" size="sm" className="me-2" />}
                  Send request
                </Button>
                <Button type="button" variant="outline-secondary" onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
              </div>
            </Form>
          </Panel>
        </Col>

        <Col lg={5}>
          <Panel
            title="What the mentor will see"
            actions={<Link to="/student/profile" className="btn btn-sm btn-outline-primary">Edit profile</Link>}
          >
            {student ? (
              <>
                <div className="small-label">Stage</div>
                <div className="mb-2">
                  {STAGE_LABEL[student.programme_stage] || 'Not set'}
                  {student.expected_graduation_year ? ` · Class of ${student.expected_graduation_year}` : ''}
                </div>
                <div className="small-label">Career goals</div>
                <p className="small mb-2">{student.career_goals || 'Not provided'}</p>
                <div className="small-label">Guidance needs</div>
                <p className="small mb-2">{student.guidance_needs || 'Not provided'}</p>
                <div className="small-label">Skills</div>
                <div className="mb-2">
                  {(student.skills || []).map((skill) => (
                    <Chip key={skill.skill_id}>
                      {skill.skill_name} · {LEVEL_LABEL[skill.proficiency_level]}{skill.is_focus ? ' ★' : ''}
                    </Chip>
                  ))}
                  {(student.skills || []).length === 0 && <span className="text-muted small">None added</span>}
                </div>
                <div className="small-label">Career interests</div>
                <div>
                  {(student.interests || []).map((interest) => <Chip key={interest.interest_id}>{interest.interest_name}</Chip>)}
                  {(student.interests || []).length === 0 && <span className="text-muted small">None added</span>}
                </div>
              </>
            ) : <Loading rows={4} />}
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== page 10 */

const REQUEST_TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'pending', label: 'Pending', match: (row) => row.status === 'pending' },
  { key: 'accepted', label: 'Accepted', match: (row) => row.status === 'accepted' },
  { key: 'declined', label: 'Declined', match: (row) => row.status === 'declined' },
  { key: 'closed', label: 'Cancelled / expired', match: (row) => ['cancelled', 'expired'].includes(row.status) },
];

export function MyRequests() {
  useTitle('My requests');
  const navigate = useNavigate();
  const toast = useToast();
  const requests = useApi(() => getAll('/mentoring-requests/mine'), []);
  const mentorships = useApi(() => getAll('/mentorships'), []);
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const pageSize = 10;

  const rows = requests.data || [];
  const mentorshipByRequest = useMemo(() => {
    const map = new Map();
    (mentorships.data || []).forEach((row) => map.set(row.request_id, row));
    return map;
  }, [mentorships.data]);

  const filtered = rows.filter(REQUEST_TABS.find((entry) => entry.key === tab).match);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [tab]);

  const cancel = async ({ reason }) => {
    try {
      await post(`/mentoring-requests/${cancelTarget.request_id}/cancel`, { reason: reason || null });
      toast.success('Request cancelled.');
      requests.reload({ silent: true });
    } catch (err) {
      if (err.code === 'INVALID_STATE_TRANSITION') {
        toast.error('That request was already decided. The list has been refreshed.');
        requests.reload({ silent: true });
      }
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="My mentoring requests"
        subtitle="Track every request and cancel pending ones."
        actions={<Link to="/student/mentors" className="btn btn-primary">Find a mentor</Link>}
      />

      {requests.error && <ErrorState error={requests.error} onRetry={requests.reload} />}
      {requests.loading && <Loading label="Loading requests…" rows={4} />}

      {!requests.loading && !requests.error && (
        <>
          <CountTabs
            active={tab}
            onChange={setTab}
            tabs={REQUEST_TABS.map((entry) => ({
              ...entry,
              count: rows.filter(entry.match).length,
            }))}
          />

          <Panel bodyClassName="p-0">
            <DataTable
              rows={pageRows}
              rowKey={(row) => row.request_id}
              empty={(
                <EmptyState
                  icon="✉"
                  title={tab === 'pending' ? 'No pending requests' : 'No requests here'}
                  action={<Link to="/student/mentors" className="btn btn-sm btn-primary">Find a mentor</Link>}
                >
                  {tab === 'all' ? 'You have not sent any requests yet.' : 'Requests appear here as their status changes.'}
                </EmptyState>
              )}
              columns={[
                {
                  key: 'mentor',
                  label: 'Mentor',
                  render: (row) => (
                    <div>
                      <div className="fw-semibold">{row.mentor_name}</div>
                      <div className="small text-muted">Sent {fmtDate(row.created_at)}</div>
                    </div>
                  ),
                },
                {
                  key: 'goal',
                  label: 'Career goal',
                  render: (row) => (
                    <span className="text-truncate d-inline-block" style={{ maxWidth: '36ch' }} title={row.career_goal}>
                      {row.career_goal}
                    </span>
                  ),
                },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                {
                  key: 'timing',
                  label: 'Decision / expiry',
                  render: (row) => (row.status === 'pending'
                    ? <span className="small text-muted">{untilText(row.expires_at)}</span>
                    : <span className="small text-muted">{row.responded_at ? fmtDate(row.responded_at) : '—'}</span>),
                },
                {
                  key: 'actions',
                  label: '',
                  className: 'text-end',
                  render: (row) => (
                    <div className="d-flex gap-1 justify-content-end flex-wrap">
                      <Button size="sm" variant="outline-secondary" onClick={() => setDrawer(row.request_id)}>View</Button>
                      {row.status === 'pending' && (
                        <Button size="sm" variant="outline-danger" onClick={() => setCancelTarget(row)}>Cancel</Button>
                      )}
                      {row.status === 'accepted' && mentorshipByRequest.get(row.request_id) && (
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => navigate(`/student/mentorships/${mentorshipByRequest.get(row.request_id).mentorship_id}`)}
                        >
                          Open mentorship
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
              mobileTitle={(row) => `${row.mentor_name} · ${row.status}`}
            />
          </Panel>

          {filtered.length > pageSize && (
            <Pager
              meta={{ page, page_size: pageSize, total: filtered.length, total_pages: totalPages }}
              onPage={setPage}
            />
          )}
        </>
      )}

      <RequestDrawer show={Boolean(drawer)} requestId={drawer} onHide={() => setDrawer(null)} />

      <ReasonDialog
        show={Boolean(cancelTarget)}
        onHide={() => setCancelTarget(null)}
        title="Cancel this request?"
        prompt={`${cancelTarget?.mentor_name || 'The mentor'} will have a notification in this browser demo only.`}
        confirmLabel="Cancel request"
        onSubmit={cancel}
      />
    </>
  );
}

/* ================================================================== page 11 */

export function MentorshipDetail() {
  useTitle('Mentorship');
  const { mentorship_id: mentorshipId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useApi(() => getAll('/mentorships'), []);
  const detail = useApi(() => get(`/mentorships/${mentorshipId}`), [mentorshipId]);
  const sessions = useApi(() => getAll(`/mentorships/${mentorshipId}/sessions`), [mentorshipId]);
  const [booking, setBooking] = useState(false);
  const [cancelSession, setCancelSession] = useState(null);
  const [endOpen, setEndOpen] = useState(false);

  const data = detail.data?.data;

  useEffect(() => {
    if (detail.error?.code === 'NOT_FOUND') {
      toast.info('That mentorship is not available.');
      navigate('/student/requests', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.error]);

  const upcoming = (sessions.data || [])
    .filter((session) => session.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));

  const endMentorship = async ({ reason, choice }) => {
    if (choice === 'ended' && !reason) {
      throw new Error('A reason is required when ending a mentorship early.');
    }
    await patch(`/mentorships/${mentorshipId}`, { status: choice, reason: reason || null });
    toast.success(choice === 'completed' ? 'Mentorship marked completed.' : 'Mentorship ended.');
    detail.reload({ silent: true });
    sessions.reload({ silent: true });
    list.reload({ silent: true });
  };

  const doCancel = async ({ reason }) => {
    await patch(`/sessions/${cancelSession.session_id}`, { status: 'cancelled', cancel_reason: reason || null });
    toast.success('Session cancelled.');
    sessions.reload({ silent: true });
    detail.reload({ silent: true });
  };

  if (detail.loading) return <Loading label="Loading mentorship…" rows={5} />;
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />;

  return (
    <>
      <PageHeader
        title="My mentorship"
        subtitle={data ? `with ${data.mentor_name} · started ${fmtDate(data.started_at)}` : undefined}
        actions={(
          <>
            {data?.status === 'active' && (
              <>
                <Button variant="primary" onClick={() => setBooking(true)}>Schedule session</Button>
                <Button variant="outline-danger" onClick={() => setEndOpen(true)}>End mentorship</Button>
              </>
            )}
            <Link to={`/student/mentors/${data?.mentor_id}`} className="btn btn-outline-secondary">View mentor profile</Link>
          </>
        )}
      />

      {(list.data || []).length > 1 && (
        <Form.Group className="mb-3" style={{ maxWidth: 440 }}>
          <Form.Label>Mentorship</Form.Label>
          <Form.Select
            value={mentorshipId}
            onChange={(event) => navigate(`/student/mentorships/${event.target.value}`)}
          >
            {(list.data || []).map((row) => (
              <option key={row.mentorship_id} value={row.mentorship_id}>
                {row.mentor_name} · {row.status} · {fmtDate(row.started_at)}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><span className="nav-link active">Overview</span></li>
        <li className="nav-item">
          <button type="button" className="nav-link" onClick={() => navigate(`/student/mentorships/${mentorshipId}/sessions`)}>
            Sessions and feedback
          </button>
        </li>
      </ul>

      <Row className="g-3">
        <Col lg={8}>
          <Panel>
            <div className="d-flex flex-wrap justify-content-between gap-3">
              <div className="d-flex gap-3">
                <div className="avatar" style={{ width: 54, height: 54 }}>{initials(data.mentor_name)}</div>
                <div>
                  <div className="fw-semibold">{data.mentor_name}</div>
                  <div className="small text-muted">Mentor</div>
                  <div className="small text-muted mt-1">Started {fmtDate(data.started_at)}</div>
                </div>
              </div>
              <StatusBadge status={data.status} />
            </div>

            <hr />
            <h3 className="section-title mb-2">Career goal</h3>
            <p className="mb-0">{data.career_goal || '—'}</p>

            <h3 className="section-title mt-4 mb-2">Progress</h3>
            <Row className="g-2">
              <Col xs={6} md={3}><div className="note-box"><div className="stat-value fs-4">{data.sessions_completed}</div><div className="small text-muted">Sessions completed</div></div></Col>
              <Col xs={6} md={3}><div className="note-box"><div className="stat-value fs-4">{data.sessions_scheduled}</div><div className="small text-muted">Scheduled</div></div></Col>
              <Col xs={12} md={6}><div className="note-box"><div className="fw-semibold">{data.last_session_at ? fmtDate(data.last_session_at) : '—'}</div><div className="small text-muted">Last session</div></div></Col>
            </Row>

            {data.end_reason && (
              <div className="review-note mt-3">
                <div className="small-label mb-1">Closure note</div>
                {data.end_reason}
              </div>
            )}
          </Panel>

          <Panel
            title="Upcoming sessions"
            className="mt-3"
            actions={<Button size="sm" variant="outline-primary" disabled={data.status !== 'active'} onClick={() => setBooking(true)}>Schedule session</Button>}
          >
            {sessions.loading && <Loading label="Loading sessions…" rows={2} />}
            {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.reload} />}
            {!sessions.loading && !sessions.error && upcoming.length === 0 && (
              <EmptyState icon="◷" title="No upcoming sessions">
                {data.status === 'active' ? 'Book one of your mentor\'s open slots.' : 'This mentorship is closed.'}
              </EmptyState>
            )}
            <div className="list-tight">
              {upcoming.map((session) => (
                <div key={session.session_id} className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                  <div>
                    <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
                    <div className="small text-muted text-capitalize">{session.meeting_mode.replace('_', ' ')} · {fmtTime(session.scheduled_end)} end</div>
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    {session.meeting_link && <a className="btn btn-sm btn-teal" aria-disabled="true" title="Presentation only: external meetings are disabled in this demo.">Join (demo only)</a>}
                    <Button size="sm" variant="outline-danger" onClick={() => setCancelSession(session)}>Cancel</Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Col>

        <Col lg={4}>
          <Panel title="Mentorship status">
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Status</span><StatusBadge status={data.status} />
            </div>
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Started</span><span>{fmtDate(data.started_at)}</span>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Ended</span><span>{data.ended_at ? fmtDate(data.ended_at) : '—'}</span>
            </div>
            <div className="policy-note mt-3">
              {data.status === 'active'
                ? 'Scheduling and feedback stay available while the mentorship is active. Ending it cancels future sessions.'
                : 'This mentorship is closed. You can still read the session history and feedback.'}
            </div>
          </Panel>
        </Col>
      </Row>

      <BookingDialog
        show={booking}
        onHide={() => setBooking(false)}
        mentorshipId={mentorshipId}
        mentorId={data.mentor_id}
        mode="student"
        onBooked={() => {
          toast.success('Session booked.');
          sessions.reload({ silent: true });
          detail.reload({ silent: true });
        }}
      />

      <ReasonDialog
        show={Boolean(cancelSession)}
        onHide={() => setCancelSession(null)}
        title="Cancel this session?"
        prompt={cancelSession ? `${fmtDateTime(cancelSession.scheduled_start)} · local demo notifications are added.` : ''}
        confirmLabel="Cancel session"
        onSubmit={doCancel}
      />

      <ReasonDialog
        show={endOpen}
        onHide={() => setEndOpen(false)}
        title="End this mentorship"
        prompt="Mark it completed when the goals were met, or ended early if it is no longer useful. Future sessions are cancelled."
        choice={{
          label: 'How should it close?',
          defaultValue: 'completed',
          options: [
            { value: 'completed', label: 'Completed — the natural end' },
            { value: 'ended', label: 'Ended early — reason required' },
          ],
        }}
        confirmLabel="Close mentorship"
        onSubmit={endMentorship}
      />
    </>
  );
}

/* ================================================================== page 12 */

export function MentorshipSessions() {
  useTitle('Sessions and feedback');
  const { mentorship_id: mentorshipId } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const bundle = useApi(async () => {
    const [detail, sessionRows] = await Promise.all([
      get(`/mentorships/${mentorshipId}`),
      getAll(`/mentorships/${mentorshipId}/sessions`),
    ]);
    const feedback = {};
    await Promise.all(
      sessionRows.filter((session) => session.status === 'completed').map(async (session) => {
        try {
          const envelope = await get(`/sessions/${session.session_id}/feedback`);
          feedback[session.session_id] = envelope.data || [];
        } catch {
          feedback[session.session_id] = [];
        }
      }),
    );
    return { detail: detail.data, sessions: sessionRows, feedback };
  }, [mentorshipId]);

  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rateTarget, setRateTarget] = useState(null);
  const [booking, setBooking] = useState(false);

  const detail = bundle.data?.detail;
  const sessions = bundle.data?.sessions || [];
  const feedback = bundle.data?.feedback || {};

  const filtered = sessions
    .filter((session) => filter === 'all' || session.status === filter)
    .sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start));

  const mine = (sessionId) => (feedback[sessionId] || []).find((row) => row.submitted_by === user?.user_id);

  const canRate = (session) => {
    if (session.status !== 'completed' || session.my_feedback_submitted) return false;
    const start = new Date(session.scheduled_start).getTime();
    return Date.now() - start <= 14 * 86_400_000;
  };

  const cancel = async ({ reason }) => {
    await patch(`/sessions/${cancelTarget.session_id}`, { status: 'cancelled', cancel_reason: reason || null });
    toast.success('Session cancelled.');
    bundle.reload({ silent: true });
  };

  if (bundle.loading) return <Loading label="Loading session history…" rows={5} />;
  if (bundle.error) return <ErrorState error={bundle.error} onRetry={bundle.reload} />;

  return (
    <>
      <PageHeader
        title="Sessions and feedback"
        subtitle={detail ? `${detail.mentor_name} · ${detail.career_goal || ''}` : undefined}
        actions={(
          <>
            <Link to={`/student/mentorships/${mentorshipId}`} className="btn btn-outline-secondary">Back to overview</Link>
            <Button variant="primary" disabled={detail?.status !== 'active'} onClick={() => setBooking(true)}>Schedule session</Button>
          </>
        )}
      />

      <Tabs
        active={filter}
        onChange={setFilter}
        tabs={[
          { key: 'all', label: 'All', count: sessions.length },
          { key: 'scheduled', label: 'Scheduled', count: sessions.filter((s) => s.status === 'scheduled').length },
          { key: 'completed', label: 'Completed', count: sessions.filter((s) => s.status === 'completed').length },
          { key: 'cancelled', label: 'Cancelled', count: sessions.filter((s) => s.status === 'cancelled').length },
        ]}
      />

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState icon="◷" title="No sessions yet" action={<Button size="sm" variant="primary" onClick={() => setBooking(true)} disabled={detail?.status !== 'active'}>Schedule session</Button>}>
            Book an open slot to get started.
          </EmptyState>
        </Panel>
      ) : (
        <div className="d-grid gap-2">
          {filtered.map((session) => {
            const own = mine(session.session_id);
            const isOpen = expanded[session.session_id];
            return (
              <Panel key={session.session_id} bodyClassName="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                  <div>
                    <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
                    <div className="small text-muted text-capitalize">
                      {session.meeting_mode.replace('_', ' ')} · {fmtTime(session.scheduled_end)} end
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <StatusBadge status={session.status} />
                    {session.status === 'scheduled' && (
                      <>
                        {session.meeting_link && <a className="btn btn-sm btn-teal" aria-disabled="true" title="Presentation only: external meetings are disabled in this demo.">Join (demo only)</a>}
                        <Button size="sm" variant="outline-danger" onClick={() => setCancelTarget(session)}>Cancel</Button>
                      </>
                    )}
                    {canRate(session) && (
                      <Button size="sm" variant="primary" onClick={() => setRateTarget(session)}>Rate session</Button>
                    )}
                    {own && <Chip>Rated {own.rating}/5</Chip>}
                    {session.status === 'completed' && session.my_feedback_submitted && !own && <Chip>Feedback submitted</Chip>}
                  </div>
                </div>

                {session.notes && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      onClick={() => setExpanded((current) => ({ ...current, [session.session_id]: !isOpen }))}
                    >
                      {isOpen ? '▾ Hide notes' : '▸ Show notes'}
                    </button>
                    {isOpen && <div className="note-box mt-2">{session.notes}</div>}
                  </div>
                )}

                {own?.comments && (
                  <div className="note-box mt-2">
                    <div className="small-label mb-1">Your feedback</div>
                    {own.comments}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <BookingDialog
        show={booking}
        onHide={() => setBooking(false)}
        mentorshipId={mentorshipId}
        mentorId={detail?.mentor_id}
        mode="student"
        onBooked={() => { toast.success('Session booked.'); bundle.reload({ silent: true }); }}
      />

      <ReasonDialog
        show={Boolean(cancelTarget)}
        onHide={() => setCancelTarget(null)}
        title="Cancel this session?"
        prompt={cancelTarget ? `${fmtDateTime(cancelTarget.scheduled_start)} · a local demo notification is added.` : ''}
        confirmLabel="Cancel session"
        onSubmit={cancel}
      />

      <FeedbackDialog
        show={Boolean(rateTarget)}
        onHide={() => setRateTarget(null)}
        session={rateTarget}
        onSubmitted={() => { toast.success('Thank you — your feedback was recorded.'); bundle.reload({ silent: true }); }}
      />
    </>
  );
}

/* ================================================================== page 13 */

export function StudentProfile() {
  useTitle('My profile');
  const toast = useToast();
  const { refreshUser } = useAuth();
  const profile = useApi(() => get('/students/me/profile'), []);
  const skillsCatalogue = useApi(() => getAll('/skills'), []);
  const interestsCatalogue = useApi(() => getAll('/career-interests'), []);

  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState(EMPTY_FORM);
  const [skills, setSkills] = useState([]);
  const [interestIds, setInterestIds] = useState([]);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [initialised, setInitialised] = useState(false);

  const payload = useMemo(() => ({
    full_name: form.full_name || '',
    programme_stage: form.programme_stage,
    expected_graduation_year: form.expected_graduation_year ? Number(form.expected_graduation_year) : null,
    bio: form.bio,
    career_goals: form.career_goals,
    guidance_needs: form.guidance_needs,
    skills: skills.map((skill) => ({
      skill_id: skill.skill_id,
      proficiency_level: skill.proficiency_level,
      is_focus: Boolean(skill.is_focus),
    })),
    interest_ids: interestIds,
  }), [form, skills, interestIds]);

  useEffect(() => {
    if (!profile.data || initialised) return;
    const p = profile.data.data;
    const nextForm = {
      full_name: p.full_name || '',
      programme_stage: p.programme_stage || '',
      expected_graduation_year: p.expected_graduation_year || '',
      bio: p.bio || '',
      career_goals: p.career_goals || '',
      guidance_needs: p.guidance_needs || '',
    };
    const nextSkills = (p.skills || []).map((skill) => ({ ...skill }));
    const nextInterests = (p.interests || []).map((interest) => interest.interest_id);
    setForm(nextForm);
    setSkills(nextSkills);
    setInterestIds(nextInterests);
    setBaseline(JSON.stringify({
      full_name: nextForm.full_name,
      programme_stage: nextForm.programme_stage,
      expected_graduation_year: nextForm.expected_graduation_year ? Number(nextForm.expected_graduation_year) : null,
      bio: nextForm.bio,
      career_goals: nextForm.career_goals,
      guidance_needs: nextForm.guidance_needs,
      skills: nextSkills.map((skill) => ({
        skill_id: skill.skill_id, proficiency_level: skill.proficiency_level, is_focus: Boolean(skill.is_focus),
      })),
      interest_ids: nextInterests,
    }));
    setInitialised(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data, initialised]);

  const dirty = initialised && JSON.stringify(payload) !== baseline;

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await patch('/students/me/profile', {
        ...payload,
        expected_graduation_year: payload.expected_graduation_year,
        bio: payload.bio.trim() || null,
        guidance_needs: payload.guidance_needs.trim() || null,
      });
      toast.success('Profile saved.');
      setBaseline(JSON.stringify(payload));
      await profile.reload({ silent: true });
      await refreshUser().catch(() => {});
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (profile.loading || !initialised) return <Loading label="Loading your profile…" rows={6} />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />;

  const fieldError = (name) => error?.details?.find((detail) => detail.field === name)?.issue;

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Keep this current: matching and the mentors you contact use it."
        actions={(
          <>
            {!profile.data?.data?.profile_completed && (
              <Link to="/student/onboarding" className="btn btn-outline-primary">Open setup wizard</Link>
            )}
            {tab !== 'account' && (
              <Button variant="primary" onClick={save} disabled={!dirty || busy}>
                {busy && <Spinner animation="border" size="sm" className="me-2" />}
                Save changes
              </Button>
            )}
          </>
        )}
      />

      {error && <ApiErrorBanner error={error} />}
      {dirty && <Alert variant="info" className="py-2 small">You have unsaved changes.</Alert>}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'skills', label: 'Skills and interests' },
          { key: 'account', label: 'Account' },
        ]}
      />

      <Row className="g-3">
        <Col lg={8}>
          {tab === 'profile' && (
            <Panel title="Profile details">
              <Form>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Full name</Form.Label>
                    <Form.Control value={form.full_name} onChange={setField('full_name')} isInvalid={Boolean(fieldError('full_name'))} maxLength={120} />
                    <Form.Control.Feedback type="invalid">{fieldError('full_name')}</Form.Control.Feedback>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Programme stage</Form.Label>
                    <Form.Select value={form.programme_stage} onChange={setField('programme_stage')} isInvalid={Boolean(fieldError('programme_stage'))}>
                      <option value="">Not set</option>
                      {STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{fieldError('programme_stage')}</Form.Control.Feedback>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Graduation year</Form.Label>
                    <Form.Control
                      type="number" min={2024} max={2100} value={form.expected_graduation_year}
                      onChange={setField('expected_graduation_year')} isInvalid={Boolean(fieldError('expected_graduation_year'))}
                    />
                    <Form.Control.Feedback type="invalid">{fieldError('expected_graduation_year')}</Form.Control.Feedback>
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Bio</Form.Label>
                    <Form.Control as="textarea" rows={3} maxLength={1000} value={form.bio} onChange={setField('bio')} isInvalid={Boolean(fieldError('bio'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('bio')}</Form.Control.Feedback>
                    <div className="char-count text-end">{form.bio.length} / 1000</div>
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Career goals</Form.Label>
                    <Form.Control as="textarea" rows={3} maxLength={2000} value={form.career_goals} onChange={setField('career_goals')} isInvalid={Boolean(fieldError('career_goals'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('career_goals')}</Form.Control.Feedback>
                    <div className="char-count text-end">{form.career_goals.length} / 2000</div>
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Guidance needs</Form.Label>
                    <Form.Control as="textarea" rows={3} maxLength={2000} value={form.guidance_needs} onChange={setField('guidance_needs')} isInvalid={Boolean(fieldError('guidance_needs'))} />
                    <Form.Control.Feedback type="invalid">{fieldError('guidance_needs')}</Form.Control.Feedback>
                    <div className="char-count text-end">{form.guidance_needs.length} / 2000</div>
                  </Col>
                </Row>
              </Form>
            </Panel>
          )}

          {tab === 'skills' && (
            <Panel title="Skills and interests">
              <h3 className="section-title mb-2">Skills</h3>
              <SkillPicker catalogue={skillsCatalogue.data || []} selected={skills} onChange={setSkills} />
              <hr className="my-4" />
              <h3 className="section-title mb-2">Career interests</h3>
              <InterestPicker catalogue={interestsCatalogue.data || []} selectedIds={interestIds} onChange={setInterestIds} />
            </Panel>
          )}

          {tab === 'account' && (
            <Panel title="Change password">
              <p className="text-muted small">
                Presentation only. No password is stored or changed, and no other device is signed out.
              </p>
              <PasswordForm />
            </Panel>
          )}
        </Col>

        <Col lg={4}>
          <Panel title="Profile completeness">
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Status</span>
              <span className="fw-semibold">{profile.data?.data?.profile_completed ? 'Complete' : 'Incomplete'}</span>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Focus skills</span>
              <span className="fw-semibold">{skills.filter((skill) => skill.is_focus).length} / 5</span>
            </div>
            <div className="d-flex justify-content-between py-1">
              <span className="text-muted">Interests</span>
              <span className="fw-semibold">{interestIds.length}</span>
            </div>
            <div className="policy-note mt-3">
              A complete profile needs a programme stage, career goals and at least one career interest.
              Mentors you contact see your stage, goals, skills and interests — not your e-mail address.
            </div>
          </Panel>
        </Col>
      </Row>
    </>
  );
}

/* ================================================================== notifications (pages 14 & 21) */

const TARGET_BY_ENTITY = {
  student: {
    mentoring_request: (id) => '/student/requests',
    mentorship: (id) => (id ? `/student/mentorships/${id}` : '/student/mentorships'),
    session: () => '/student/mentorships',
    profile: () => '/student/profile',
  },
  mentor: {
    mentoring_request: (id) => (id ? `/mentor/requests/${id}` : '/mentor/requests'),
    mentorship: () => '/mentor/mentees',
    session: () => '/mentor/schedule',
    profile: () => '/mentor/profile',
    mentor_profile: () => '/mentor/profile',
  },
};

export function NotificationsPage({ audience = 'student' }) {
  useTitle('Notifications');
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const feed = useApi(
    () => get('/notifications', { page, page_size: pageSize, is_read: tab === 'unread' ? false : undefined }),
    [tab, page],
  );

  useEffect(() => { setPage(1); }, [tab]);

  const rows = feed.data?.data || [];
  const meta = feed.data?.meta;

  const open = async (item) => {
    if (!item.is_read) {
      try {
        await patch(`/notifications/${item.notification_id}`, { is_read: true });
        window.dispatchEvent(new Event('notifications:refresh'));
        feed.reload({ silent: true });
      } catch (err) {
        toast.error(err.message);
        return;
      }
    }
    const targets = TARGET_BY_ENTITY[audience] || TARGET_BY_ENTITY.student;
    const build = targets[item.related_entity_type] || targets[item.related_entity_type?.replace('_profile', '')] || (() => null);
    const to = build(item.related_entity_id);
    if (to) navigate(to);
  };

  const markAll = async () => {
    try {
      await post('/notifications/mark-all-read');
      toast.success('All notifications marked as read.');
      window.dispatchEvent(new Event('notifications:refresh'));
      feed.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Requests, sessions, feedback and profile decisions."
        actions={<Button variant="outline-primary" onClick={markAll} disabled={!meta?.unread_count}>Mark all as read</Button>}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread', count: meta?.unread_count },
        ]}
      />

      {feed.loading && <Loading label="Loading notifications…" rows={4} />}
      {feed.error && <ErrorState error={feed.error} onRetry={feed.reload} />}

      {!feed.loading && !feed.error && rows.length === 0 && (
        <Panel>
          <EmptyState icon="◔" title={tab === 'unread' ? "You're all caught up" : 'No notifications yet'}>
            {tab === 'unread' ? 'Nothing needs your attention right now.' : 'Events about your requests and sessions will appear here.'}
          </EmptyState>
        </Panel>
      )}

      {rows.length > 0 && (
        <Panel bodyClassName="p-0">
          <div className="list-tight px-3">
            {rows.map((item) => (
              <button
                key={item.notification_id}
                type="button"
                className="w-100 text-start border-0 bg-transparent py-3"
                onClick={() => open(item)}
              >
                <div className="d-flex justify-content-between gap-3">
                  <div>
                    <div className={item.is_read ? 'text-muted' : 'fw-semibold'}>
                      {!item.is_read && <span className="text-teal me-1" aria-hidden="true">●</span>}
                      {item.title}
                    </div>
                    <div className="small text-muted">{item.message}</div>
                  </div>
                  <div className="small text-muted text-nowrap">{timeAgo(item.created_at)}</div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {meta && meta.total > pageSize && <Pager meta={meta} onPage={setPage} />}
    </>
  );
}

export const StudentNotifications = () => <NotificationsPage audience="student" />;

/* re-export a couple of shared helpers used by mentor/admin pages */
export { MentorCard, CountTabs };
