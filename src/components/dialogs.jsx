import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { get, patch, post } from '../api.js';
import {
  Chip, EmptyState, ErrorState, Loading, RatingInput, StatusBadge, STAGE_LABEL,
  combineLocal, fmtDate, fmtDateTime, fmtTime, toDateInput, toTimeInput, useApi,
} from './ui.jsx';

/* ------------------------------------------------------------------ reason */

export function ReasonDialog({
  show, onHide, title, prompt, required = false, confirmLabel = 'Confirm',
  confirmVariant = 'danger', reasons = [], choice, onSubmit,
}) {
  const [reason, setReason] = useState('');
  const [choiceValue, setChoiceValue] = useState(choice?.defaultValue ?? choice?.options?.[0]?.value ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    if (show) {
      setReason('');
      setChoiceValue(choice?.defaultValue ?? choice?.options?.[0]?.value ?? '');
      setBusy(false);
      setError(null);
      setFieldError('');
    }
    // Reset only when the dialog opens; callers may pass a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const submit = async (event) => {
    event.preventDefault();
    if (required && !reason.trim()) {
      setFieldError('A reason is required.');
      return;
    }
    setBusy(true);
    setError(null);
    setFieldError('');
    try {
      await onSubmit({ reason: reason.trim(), choice: choiceValue });
      onHide();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {prompt && <p className="text-muted small mb-3">{prompt}</p>}
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          {choice && (
            <Form.Group className="mb-3">
              <Form.Label>{choice.label}</Form.Label>
              <Form.Select value={choiceValue} onChange={(event) => setChoiceValue(event.target.value)}>
                {choice.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Form.Select>
            </Form.Group>
          )}
          {reasons.length > 0 && (
            <div className="mb-2">
              {reasons.map((quick) => (
                <Chip key={quick} onClick={() => setReason(quick)}>{quick}</Chip>
              ))}
            </div>
          )}
          <Form.Group>
            <Form.Label>
              Reason {required ? <span className="text-danger">*</span> : <span className="text-muted fw-normal">(optional)</span>}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              isInvalid={Boolean(fieldError)}
              onChange={(event) => { setReason(event.target.value); setFieldError(''); }}
              maxLength={1000}
              placeholder="This is shared with the other participant."
            />
            <Form.Control.Feedback type="invalid">{fieldError}</Form.Control.Feedback>
            <div className="char-count text-end">{reason.length} / 1000</div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={confirmVariant} disabled={busy}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            {confirmLabel}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ confirm */

export function ConfirmDialog({
  show, onHide, title, body, confirmLabel = 'Confirm', variant = 'primary', onConfirm, children,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) { setBusy(false); setError(null); }
  }, [show]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onHide();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
        {body && <p className="mb-2">{body}</p>}
        {children}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
        <Button variant={variant} onClick={submit} disabled={busy}>
          {busy && <Spinner animation="border" size="sm" className="me-2" />}
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/* ------------------------------------------------------------------ feedback */

export function FeedbackDialog({ show, onHide, session, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) { setRating(0); setComments(''); setBusy(false); setError(null); }
  }, [show]);

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) { setError({ message: 'Choose a rating from 1 to 5.' }); return; }
    setBusy(true);
    setError(null);
    try {
      const envelope = await post(`/sessions/${session.session_id}/feedback`, { rating, comments: comments.trim() || null });
      onSubmitted?.(envelope.data);
      onHide();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>Rate this session</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {session && (
            <div className="note-box mb-3">
              <div className="fw-semibold">{fmtDateTime(session.scheduled_start)}</div>
              <div className="small text-muted">{session.mentor_name} · {session.student_name}</div>
            </div>
          )}
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>How was the session?</Form.Label>
            <RatingInput value={rating} onChange={setRating} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Comments <span className="text-muted fw-normal">(optional)</span></Form.Label>
            <Form.Control
              as="textarea" rows={3} value={comments} maxLength={1000}
              onChange={(event) => setComments(event.target.value)}
              placeholder="What went well? What could be better?"
            />
            <div className="char-count text-end">{comments.length} / 1000</div>
          </Form.Group>
          <div className="policy-note mt-2">Feedback is visible to the other participant and to administrators.</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !rating}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            Submit feedback
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ booking */

export function BookingDialog({ show, onHide, mentorshipId, mentorId, mode = 'student', onBooked }) {
  const [tab, setTab] = useState('slot');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [slotId, setSlotId] = useState('');
  const [meetingMode, setMeetingMode] = useState('online');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(toDateInput(new Date(Date.now() + 86_400_000)));
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadSlots = async () => {
    if (mode !== 'mentor' && !mentorId) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const path = mode === 'mentor' ? '/mentors/me/availability' : `/mentors/${mentorId}/availability`;
      const envelope = await get(path, {
        from: new Date().toISOString(),
        page_size: 50,
      });
      setSlots(envelope.data || []);
      setSlotId((current) => current || envelope.data?.[0]?.slot_id || '');
    } catch (err) {
      setSlotsError(err);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    setTab('slot');
    setSlotId('');
    setMeetingMode('online');
    setMeetingLink('');
    setNotes('');
    setError(null);
    setBusy(false);
    setSlots([]);
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, mentorId]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    let body;
    if (mode === 'mentor' && tab === 'custom') {
      if (!date || !start || !end) { setError({ message: 'Choose a date, start time and end time.' }); return; }
      const scheduledStart = combineLocal(date, start);
      const scheduledEnd = combineLocal(date, end);
      if (new Date(scheduledEnd) <= new Date(scheduledStart)) {
        setError({ message: 'The end time must be after the start time.' });
        return;
      }
      body = { scheduled_start: scheduledStart, scheduled_end: scheduledEnd };
    } else {
      if (!slotId) { setError({ message: 'Choose an open slot.' }); return; }
      body = { slot_id: slotId };
    }
    body.meeting_mode = meetingMode;
    body.meeting_link = meetingLink.trim() || null;
    body.notes = notes.trim() || null;

    setBusy(true);
    try {
      const envelope = await post(`/mentorships/${mentorshipId}/sessions`, body);
      onBooked?.(envelope.data);
      onHide();
    } catch (err) {
      setError(err);
      if (['SLOT_UNAVAILABLE', 'SESSION_CONFLICT', 'INVALID_STATE_TRANSITION'].includes(err.code)) {
        loadSlots();
      }
    } finally {
      setBusy(false);
    }
  };

  const grouped = slots.reduce((acc, slot) => {
    const key = fmtDate(slot.start_time);
    acc[key] = acc[key] || [];
    acc[key].push(slot);
    return acc;
  }, {});

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered size="lg">
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>Schedule a session</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          {mode === 'mentor' && (
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button type="button" className={`nav-link ${tab === 'slot' ? 'active' : ''}`} onClick={() => setTab('slot')}>
                  From open slots
                </button>
              </li>
              <li className="nav-item">
                <button type="button" className={`nav-link ${tab === 'custom' ? 'active' : ''}`} onClick={() => setTab('custom')}>
                  Custom time
                </button>
              </li>
            </ul>
          )}

          {(mode !== 'mentor' || tab === 'slot') && (
            <div className="mb-3">
              <Form.Label>Open slots</Form.Label>
              {slotsLoading && <Loading label="Loading availability…" rows={2} />}
              {slotsError && <ErrorState error={slotsError} onRetry={loadSlots} />}
              {!slotsLoading && !slotsError && slots.length === 0 && (
                <EmptyState icon="◷" title="No open slots">
                  {mode === 'mentor'
                    ? 'Add availability from the Schedule page so mentees can book you.'
                    : 'Your mentor has no open slots right now. Ask them to add availability.'}
                </EmptyState>
              )}
              {Object.entries(grouped).map(([day, daySlots]) => (
                <div key={day} className="mb-2">
                  <div className="small-label mb-2">{day}</div>
                  <div className="slot-grid">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.slot_id}
                        type="button"
                        className={`slot-btn ${slotId === slot.slot_id ? 'selected' : ''}`}
                        onClick={() => setSlotId(slot.slot_id)}
                      >
                        <div className="fw-semibold">{fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}</div>
                        <div className="text-muted">{fmtDateTime(slot.start_time)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mode === 'mentor' && tab === 'custom' && (
            <Row className="g-2 mb-3">
              <Col sm={4}>
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </Col>
              <Col sm={4}>
                <Form.Label>Start</Form.Label>
                <Form.Control type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
              </Col>
              <Col sm={4}>
                <Form.Label>End</Form.Label>
                <Form.Control type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
              </Col>
            </Row>
          )}

          <Row className="g-2">
            <Col sm={5}>
              <Form.Label>Meeting mode</Form.Label>
              <Form.Select value={meetingMode} onChange={(event) => setMeetingMode(event.target.value)}>
                <option value="online">Online</option>
                <option value="phone">Phone</option>
                <option value="in_person">In person</option>
              </Form.Select>
            </Col>
            <Col sm={7}>
              <Form.Label>Meeting link <span className="text-muted fw-normal">(optional)</span></Form.Label>
              <Form.Control
                type="url" value={meetingLink} placeholder="https://…"
                onChange={(event) => setMeetingLink(event.target.value)}
              />
            </Col>
            <Col xs={12}>
              <Form.Label>Notes <span className="text-muted fw-normal">(optional)</span></Form.Label>
              <Form.Control
                as="textarea" rows={2} value={notes} maxLength={4000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Agenda or preparation notes shared with both participants."
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            Book session
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ slots */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function SlotEditorDialog({ show, onHide, slot, onSaved, onDelete }) {
  const editing = Boolean(slot);
  const [tab, setTab] = useState('single');
  const [date, setDate] = useState(toDateInput());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [weekdays, setWeekdays] = useState([0]);
  const [weeks, setWeeks] = useState(4);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!show) return;
    setTab('single');
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
    setAvailable(slot ? slot.is_available : true);
    setDate(slot ? toDateInput(slot.start_time) : toDateInput());
    setStart(slot ? toTimeInput(slot.start_time) : '10:00');
    setEnd(slot ? toTimeInput(slot.end_time) : '11:00');
    setWeekdays([0]);
    setWeeks(4);
  }, [show, slot]);

  const toggleDay = (day) => {
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      if (editing) {
        const body = { is_available: available };
        if (date && start && end) {
          body.start_time = combineLocal(date, start);
          body.end_time = combineLocal(date, end);
        }
        if (new Date(body.end_time) <= new Date(body.start_time)) {
          setError({ message: 'The end time must be after the start time.' });
          return;
        }
        setBusy(true);
        const envelope = await patch(`/mentors/me/availability/${slot.slot_id}`, body);
        onSaved?.(envelope.data);
        onHide();
        return;
      }

      setBusy(true);
      let body;
      if (tab === 'single') {
        const startIso = combineLocal(date, start);
        const endIso = combineLocal(date, end);
        if (new Date(endIso) <= new Date(startIso)) {
          setError({ message: 'The end time must be after the start time.' });
          setBusy(false);
          return;
        }
        body = { slots: [{ start_time: startIso, end_time: endIso }] };
      } else {
        if (weekdays.length === 0) {
          setError({ message: 'Choose at least one weekday.' });
          setBusy(false);
          return;
        }
        body = {
          recurrence: {
            weekdays, weeks: Number(weeks),
            start_time: start, end_time: end,
            zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
      }
      const envelope = await post('/mentors/me/availability', body);
      onSaved?.(envelope.data);
      onHide();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete(slot);
      onHide();
    } catch (err) {
      setError(err);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{editing ? 'Edit availability slot' : 'Add availability'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          {!editing && (
            <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button type="button" className={`nav-link ${tab === 'single' ? 'active' : ''}`} onClick={() => setTab('single')}>
                  Single slot
                </button>
              </li>
              <li className="nav-item">
                <button type="button" className={`nav-link ${tab === 'recurrence' ? 'active' : ''}`} onClick={() => setTab('recurrence')}>
                  Weekly recurrence
                </button>
              </li>
            </ul>
          )}

          {(!editing && tab === 'recurrence') ? (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Weekdays</Form.Label>
                <div>
                  {WEEKDAYS.map((label, index) => (
                    <Chip key={label} selected={weekdays.includes(index)} onClick={() => toggleDay(index)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </Form.Group>
              <Row className="g-2 mb-3">
                <Col xs={4}>
                  <Form.Label>Start</Form.Label>
                  <Form.Control type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
                </Col>
                <Col xs={4}>
                  <Form.Label>End</Form.Label>
                  <Form.Control type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
                </Col>
                <Col xs={4}>
                  <Form.Label>Weeks</Form.Label>
                  <Form.Control
                    type="number" min={1} max={12} value={weeks}
                    onChange={(event) => setWeeks(event.target.value)} required
                  />
                </Col>
              </Row>
              <div className="policy-note">
                Repeats the slot on each selected weekday for {weeks} week{Number(weeks) === 1 ? '' : 's'} starting next Monday.
              </div>
            </>
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Date</Form.Label>
                <Form.Control type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
              </Form.Group>
              <Row className="g-2 mb-3">
                <Col>
                  <Form.Label>Start</Form.Label>
                  <Form.Control type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
                </Col>
                <Col>
                  <Form.Label>End</Form.Label>
                  <Form.Control type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
                </Col>
              </Row>
            </>
          )}

          {editing && (
            <Form.Check
              type="switch"
              id="slot-available"
              label="Slot is open for booking"
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          {editing && onDelete && (
            confirmDelete ? (
              <Button variant="danger" onClick={remove} disabled={busy} className="me-auto">
                {busy ? 'Deleting…' : 'Confirm delete'}
              </Button>
            ) : (
              <Button
                variant="outline-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="me-auto"
                title={slot?.booked ? 'Booked slots cannot be deleted' : 'Delete this slot'}
              >
                Delete slot
              </Button>
            )
          )}
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            {editing ? 'Save slot' : 'Add slots'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ request drawer */

export function RequestDrawer({ show, onHide, requestId, title = 'Request details' }) {
  const { data, loading, error, reload } = useApi(
    () => get(`/mentoring-requests/${requestId}`),
    [requestId, show],
    { immediate: false },
  );

  useEffect(() => {
    if (show && requestId) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, requestId]);

  const request = data?.data;

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: 'min(480px, 100vw)' }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {loading && <Loading label="Loading request…" rows={4} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {request && (
          <>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div>
                <div className="small-label">To</div>
                <div className="fw-semibold">{request.mentor_name}</div>
              </div>
              <StatusBadge status={request.status} />
            </div>
            <div className="small-label">Career goal</div>
            <p className="mt-1">{request.career_goal}</p>
            {request.message && (
              <>
                <div className="small-label">Message</div>
                <p className="mt-1 mb-3">{request.message}</p>
              </>
            )}
            <div className="note-box mb-3">
              <div className="d-flex justify-content-between"><span className="text-muted">Sent</span><span>{fmtDateTime(request.created_at)}</span></div>
              <div className="d-flex justify-content-between"><span className="text-muted">Expires</span><span>{fmtDateTime(request.expires_at)}</span></div>
              {request.responded_at && (
                <div className="d-flex justify-content-between"><span className="text-muted">Decision</span><span>{fmtDateTime(request.responded_at)}</span></div>
              )}
            </div>
            {request.status_reason && (
              <div className="review-note mb-3">
                <div className="small-label mb-1">Decision note</div>
                {request.status_reason}
              </div>
            )}
            {request.student_summary && (
              <div className="mt-3">
                <h6 className="section-title mb-2">Student profile</h6>
                <div className="small text-muted mb-1">
                  {STAGE_LABEL[request.student_summary.programme_stage] || request.student_summary.programme_stage}
                  {request.student_summary.expected_graduation_year && ` · Class of ${request.student_summary.expected_graduation_year}`}
                </div>
                {request.student_summary.bio && <p className="small">{request.student_summary.bio}</p>}
                {request.student_summary.career_goals && (
                  <>
                    <div className="small-label mt-2">Goals</div>
                    <p className="small">{request.student_summary.career_goals}</p>
                  </>
                )}
                {request.student_summary.skills?.length > 0 && (
                  <>
                    <div className="small-label mt-2">Skills</div>
                    <div className="mt-1">
                      {request.student_summary.skills.map((skill) => (
                        <Chip key={skill.skill_id}>
                          {skill.skill_name} · {skill.proficiency_level}{skill.is_focus ? ' ★' : ''}
                        </Chip>
                      ))}
                    </div>
                  </>
                )}
                {request.student_summary.interests?.length > 0 && (
                  <>
                    <div className="small-label mt-2">Career interests</div>
                    <div className="mt-1">
                      {request.student_summary.interests.map((interest) => <Chip key={interest}>{interest}</Chip>)}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

/* ------------------------------------------------------------------ catalogue */

export function CatalogueDialog({ show, onHide, kind, item, onSaved }) {
  const editing = Boolean(item);
  const isSkill = kind === 'skill';
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!show) return;
    setName(item ? (isSkill ? item.skill_name : item.interest_name) : '');
    setCategory(item?.category || '');
    setDescription(item?.description || '');
    setActive(item ? item.is_active !== false : true);
    setBusy(false);
    setError(null);
  }, [show, item, isSkill]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let envelope;
      if (isSkill) {
        const body = { skill_name: name.trim(), category: category.trim() || null };
        if (editing) body.is_active = active;
        envelope = editing
          ? await patch(`/admin/skills/${item.skill_id}`, body)
          : await post('/admin/skills', body);
      } else {
        const body = { interest_name: name.trim(), description: description.trim() || null };
        if (editing) body.is_active = active;
        envelope = editing
          ? await patch(`/admin/career-interests/${item.interest_id}`, body)
          : await post('/admin/career-interests', body);
      }
      onSaved?.(envelope.data);
      onHide();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>
            {editing ? 'Edit' : 'Add'} {isSkill ? 'skill' : 'career interest'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              value={name} maxLength={100} required
              onChange={(event) => setName(event.target.value)}
              placeholder={isSkill ? 'e.g. Data Visualisation' : 'e.g. Product Management'}
            />
          </Form.Group>
          {isSkill ? (
            <Form.Group className="mb-3">
              <Form.Label>Category <span className="text-muted fw-normal">(optional)</span></Form.Label>
              <Form.Control
                value={category} maxLength={80}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Data"
              />
            </Form.Group>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>Description <span className="text-muted fw-normal">(optional)</span></Form.Label>
              <Form.Control
                as="textarea" rows={2} value={description} maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Form.Group>
          )}
          {editing && (
            <Form.Check
              type="switch" id="catalogue-active" label="Active (available for selection)"
              checked={active} onChange={(event) => setActive(event.target.checked)}
            />
          )}
          {editing && !active && (
            <div className="policy-note mt-2">Retired entries stay on existing profiles but cannot be selected again.</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            {editing ? 'Save changes' : 'Add entry'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ session edit */

export function SessionEditDialog({ show, onHide, session, onSaved }) {
  const [meetingMode, setMeetingMode] = useState('online');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!show) return;
    setMeetingMode(session?.meeting_mode || 'online');
    setMeetingLink(session?.meeting_link || '');
    setNotes(session?.notes || '');
    setBusy(false);
    setError(null);
  }, [show, session]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const envelope = await patch(`/sessions/${session.session_id}`, {
        meeting_mode: meetingMode,
        meeting_link: meetingLink.trim() || null,
        notes: notes.trim() || null,
      });
      onSaved?.(envelope.data);
      onHide();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!busy}><Modal.Title>Edit session</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          {session && <div className="note-box mb-3 small">{fmtDateTime(session.scheduled_start)} · {session.student_name} / {session.mentor_name}</div>}
          <Form.Group className="mb-3">
            <Form.Label>Meeting mode</Form.Label>
            <Form.Select value={meetingMode} onChange={(event) => setMeetingMode(event.target.value)}>
              <option value="online">Online</option>
              <option value="phone">Phone</option>
              <option value="in_person">In person</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Meeting link</Form.Label>
            <Form.Control type="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://…" />
          </Form.Group>
          <Form.Group>
            <Form.Label>Notes</Form.Label>
            <Form.Control as="textarea" rows={4} value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} />
            <div className="char-count text-end">{notes.length} / 4000</div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            Save session
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
