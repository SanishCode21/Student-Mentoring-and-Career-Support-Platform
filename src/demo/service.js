import { createDemoStore } from './store.js';
import { createViews, paginate } from './views.js';
import { createAnalytics } from './analytics.js';
import { fail, invalid } from './errors.js';

/** In-process demo service. Paths are lookup keys, never URLs to be fetched. */
export function createDemoService(store = createDemoStore()) {
  const v = createViews(store);
  const analytics = createAnalytics(store);
  const found = (row) => row || fail('NOT_FOUND', 'That sample record is not available.', 404);
  const ok = (data) => ({ data });
  const list = (rows, params, extra) => paginate(rows, params, extra);
  const matches = (row, params, keys) => keys.every((key) => !params[key] || row[key] === params[key]);
  const contains = (value, query) => String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
  const length = (value, field, min, max) => {
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) invalid(field, `Use ${min}-${max} characters.`);
  };
  const owns = (row, viewer) => { found(row); if (!v.own(row, viewer)) fail('NOT_FOUND', 'This record belongs to another demo account.', 404); return row; };
  const editable = (row, viewer) => { owns(row, viewer); if (viewer.role === 'admin') fail('FORBIDDEN', 'Only the demo participants can perform this action.', 403); return row; };
  const audit = (action, type, id, details = {}) => store.data.audit.unshift({ audit_id: store.id('audit'),
    actor_user_id: store.user()?.user_id || null, action, entity_type: type, entity_id: id, details, created_at: store.now() });
  const notify = (userId, title, type, entity, id) => store.data.notifications.unshift({
    notification_id: store.id('notification'), user_id: userId, title: `Demo: ${title}`,
    message: 'Simulated in this browser only. No email or external notification was sent.',
    notification_type: type, related_entity_type: entity, related_entity_id: id,
    is_read: false, read_at: null, created_at: store.now(),
  });
  const active = (relationship) => { if (relationship.status !== 'active') fail('MENTORSHIP_NOT_ACTIVE', 'This sample mentorship is closed.'); };
  const mentorAvailable = (id) => {
    const profile = found(v.mentor(id));
    if (v.user(id)?.account_status !== 'active' || profile.profile_status !== 'approved' || !profile.is_available) fail('MENTOR_NOT_AVAILABLE', 'This demo mentor is not accepting requests.');
    if (v.countActive(id) >= profile.max_active_mentees) fail('MENTOR_AT_CAPACITY', 'This demo mentor is at capacity.');
    return profile;
  };
  const pending = (request) => { if (request.status !== 'pending') fail('INVALID_STATE_TRANSITION', 'This demo request has already been decided.'); };
  const validateSkills = (rows, field, levelKey) => {
    if (!Array.isArray(rows)) invalid(field, 'Choose skills from the local catalogue.');
    const ids = new Set();
    rows.forEach((row) => {
      if (ids.has(row.skill_id)) invalid(field, 'Choose each skill once.');
      ids.add(row.skill_id);
      if (!store.data.skills.some((skill) => skill.skill_id === row.skill_id && skill.is_active)) invalid(field, 'Choose an active sample skill.');
      if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(row[levelKey])) invalid(field, 'Choose a valid skill level.');
    });
  };
  const validateInterests = (ids) => {
    if (!Array.isArray(ids) || ids.some((id) => !store.data.interests.some((row) => row.interest_id === id && row.is_active))) invalid('interest_ids', 'Choose interests from the local catalogue.');
  };
  const dateValue = (value, field) => { if (!value || !Number.isFinite(Date.parse(value))) invalid(field, 'Choose a valid date and time.'); return new Date(value).toISOString(); };
  const interval = (start, end) => {
    if (Date.parse(start) >= Date.parse(end)) invalid('end_time', 'End time must be after start time.');
    if (Date.parse(end) - Date.parse(start) > 4 * 3600000) invalid('end_time', 'Use a duration of four hours or less.');
  };
  const overlap = (a, b, c, d) => Date.parse(a) < Date.parse(d) && Date.parse(b) > Date.parse(c);
  const sessionConflict = (row, exclude) => store.data.sessions.some((other) => other.session_id !== exclude && other.status === 'scheduled'
    && (row.student_id === other.student_id || row.mentor_id === other.mentor_id)
    && overlap(row.scheduled_start, row.scheduled_end, other.scheduled_start, other.scheduled_end));

  function route(method, path, body = {}, params = {}) {
    const d = store.data;
    const parts = path.split('/').filter(Boolean);
    const [resource, id, action] = parts;
    let viewer;

    if (resource === 'auth') {
      if (method === 'POST' && id === 'login') {
        const row = d.users.find((user) => user.email.toLowerCase() === String(body.email || '').trim().toLowerCase());
        if (!row || String(body.password || '').length < 10) fail('INVALID_CREDENTIALS', 'Choose a sample account and enter a demo password of at least 10 characters.', 401);
        if (row.account_status !== 'active') fail('ACCOUNT_SUSPENDED', 'This sample account is inactive.', 403);
        row.last_login_at = store.now();
        store.signIn(row.user_id);
        return ok({ user: v.userRow(row) }); // Deliberately no JWT or production token.
      }
      if (method === 'POST' && id === 'refresh') return ok({ user: v.userRow(store.requireUser()) });
      if (method === 'POST' && id === 'logout') { store.signOut(); return {}; }
      if (method === 'POST' && id === 'register') {
        length(body.full_name, 'full_name', 1, 120);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || '')) invalid('email', 'Enter a valid fictional email address.');
        length(body.password, 'password', 10, 200);
        if (!['student', 'mentor'].includes(body.role)) invalid('role', 'Choose student or mentor.');
        if (d.users.some((row) => row.email.toLowerCase() === body.email.trim().toLowerCase())) invalid('email', 'This demo email is already in use.');
        const row = { user_id: store.id('user'), full_name: body.full_name.trim(), email: body.email.trim().toLowerCase(),
          role: body.role, account_status: 'active', email_verified: false, created_at: store.now(), last_login_at: null };
        d.users.push(row); // Passwords are never persisted or verified in demonstration mode.
        if (row.role === 'student') d.students.push({ user_id: row.user_id, student_profile_id: store.id('profile'),
          programme_stage: '', expected_graduation_year: null, bio: '', career_goals: '', guidance_needs: '', profile_completed: false, skills: [], interest_ids: [] });
        else d.mentors.push({ mentor_id: row.user_id, mentor_type: 'alumni', professional_title: '', organisation: '',
          experience_years: null, graduation_year: null, bio: '', linkedin_url: '', is_available: true,
          max_active_mentees: 3, profile_status: 'draft', expertise: [], interest_ids: [], review_note: null, reviewed_at: null, created_at: store.now() });
        audit('demo.account.created', 'user', row.user_id);
        return ok(v.userRow(row));
      }
      if (method === 'POST' && ['forgot-password', 'reset-password', 'verify-email'].includes(id)) {
        if (id === 'forgot-password' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || '')) invalid('email', 'Enter a fictional email address.');
        if (id === 'reset-password') { length(body.new_password, 'new_password', 10, 200); if (body.token !== 'demo-preview') fail('INVALID_TOKEN', 'Use the demo reset preview link.', 400); }
        return ok({ demo_only: true, message: 'Presentation only. No email was sent and no real credential was changed.' });
      }
    }

    viewer = store.requireUser();
    if (resource === 'users' && id === 'me') {
      if (method === 'GET' && parts.length === 2) return ok(v.userRow(viewer));
      if (method === 'POST' && action === 'password') {
        length(body.new_password, 'new_password', 10, 200);
        return ok({ demo_only: true, message: 'Password form demonstrated; no real password is stored or changed.' });
      }
    }

    if ((resource === 'students' || resource === 'mentors') && id === 'me' && action === 'profile') {
      store.requireUser([resource === 'students' ? 'student' : 'mentor']);
      const isStudent = resource === 'students';
      const profile = found(isStudent ? v.student(viewer.user_id) : v.mentor(viewer.user_id));
      if (method === 'GET') return ok(isStudent ? v.studentProfile(viewer.user_id) : v.mentorProfile(viewer.user_id));
      if (method === 'PATCH') {
        if (body.full_name !== undefined) { length(body.full_name, 'full_name', 1, 120); viewer.full_name = body.full_name.trim(); }
        const keys = isStudent ? ['programme_stage', 'expected_graduation_year', 'bio', 'career_goals', 'guidance_needs']
          : ['mentor_type', 'professional_title', 'organisation', 'experience_years', 'graduation_year', 'bio', 'linkedin_url', 'is_available', 'max_active_mentees'];
        if (body.skills) { validateSkills(body.skills, 'skills', 'proficiency_level'); if (body.skills.filter((row) => row.is_focus).length > 5) invalid('skills', 'Choose up to five focus skills.'); profile.skills = structuredClone(body.skills); }
        if (body.expertise) { validateSkills(body.expertise, 'expertise', 'expertise_level'); profile.expertise = structuredClone(body.expertise); }
        if (body.interest_ids) { validateInterests(body.interest_ids); profile.interest_ids = [...new Set(body.interest_ids)]; }
        if (body.max_active_mentees !== undefined && (!Number.isInteger(body.max_active_mentees) || body.max_active_mentees < Math.max(1, v.countActive(viewer.user_id)) || body.max_active_mentees > 10)) invalid('max_active_mentees', 'Choose 1-10, at least your current active mentee count.');
        keys.forEach((key) => { if (body[key] !== undefined) profile[key] = body[key]; });
        if (isStudent) profile.profile_completed = Boolean(profile.programme_stage && profile.career_goals?.trim() && profile.skills.length && profile.interest_ids.length);
        else if (body.submit_for_review) {
          ['professional_title', 'organisation', 'bio'].forEach((key) => { if (!profile[key]?.trim()) invalid(key, 'Required for the sample review.'); });
          if (profile.experience_years == null || !profile.expertise.length) invalid('expertise', 'Provide experience and at least one expertise skill.');
          profile.profile_status = 'pending_review';
          audit('demo.mentor.submitted', 'mentor_profile', viewer.user_id);
        }
        return ok(isStudent ? v.studentProfile(viewer.user_id) : v.mentorProfile(viewer.user_id));
      }
    }

    if (['skills', 'career-interests'].includes(resource) && method === 'GET' && parts.length === 1) {
      const isSkill = resource === 'skills';
      const rows = (isSkill ? d.skills : d.interests).filter((row) => (params.include_inactive && viewer.role === 'admin' || row.is_active)
        && contains(isSkill ? row.skill_name : row.interest_name, params.q)).map((row) => ({ ...row,
        ...(params.with_usage ? { usage_count: [...d.students, ...d.mentors].filter((profile) => isSkill
          ? (profile.skills || profile.expertise || []).some((skill) => skill.skill_id === row.skill_id)
          : profile.interest_ids.includes(row.interest_id)).length } : {}) }));
      return list(rows, params);
    }

    if (resource === 'mentors' && id === 'me' && action === 'availability') {
      store.requireUser(['mentor']);
      const slotId = parts[3];
      if (method === 'GET') return list(d.slots.filter((row) => row.mentor_id === viewer.user_id && (!params.from || row.end_time >= params.from)
        && (!params.to || row.start_time <= params.to) && (params.is_available === undefined || row.is_available === params.is_available))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)).map(v.slot), { ...params, page_size: 50 });
      if (method === 'POST' && !slotId) {
        let input = body.slots;
        if (body.recurrence) {
          const { weekdays, weeks, start_time: startTime, end_time: endTime } = body.recurrence;
          if (!Array.isArray(weekdays) || !weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) invalid('weekdays', 'Choose weekdays for the sample recurrence.');
          if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) invalid('weeks', 'Choose 1-12 weeks.');
          if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) invalid('start_time', 'Choose start and end times.');
          input = [];
          for (let day = 0; day < weeks * 7; day += 1) {
            const start = new Date(store.now()); start.setDate(start.getDate() + day);
            if (!weekdays.includes((start.getDay() + 6) % 7)) continue;
            const end = new Date(start);
            start.setHours(...startTime.split(':').map(Number), 0, 0); end.setHours(...endTime.split(':').map(Number), 0, 0);
            if (start.getTime() > Date.parse(store.now())) input.push({ start_time: start.toISOString(), end_time: end.toISOString() });
          }
        }
        if (!Array.isArray(input) || !input.length) invalid('slots', 'Add at least one future slot.');
        const created = input.map((item) => {
          const start = dateValue(item.start_time, 'start_time'), end = dateValue(item.end_time, 'end_time');
          interval(start, end);
          if (start <= store.now()) invalid('start_time', 'Choose a future slot.');
          if (d.slots.some((row) => row.mentor_id === viewer.user_id && overlap(start, end, row.start_time, row.end_time))) fail('SLOT_OVERLAP', 'This overlaps an existing sample availability slot.');
          const row = { slot_id: store.id('slot'), mentor_id: viewer.user_id, start_time: start, end_time: end, is_available: item.is_available !== false };
          d.slots.push(row); return v.slot(row);
        });
        return list(created, { page_size: 50 });
      }
      if (slotId) {
        const row = found(d.slots.find((item) => item.slot_id === slotId && item.mentor_id === viewer.user_id));
        if (v.slot(row).booked) fail('SLOT_BOOKED', 'Cancel the sample session before changing its availability slot.');
        if (method === 'DELETE') { d.slots.splice(d.slots.indexOf(row), 1); return {}; }
        if (method === 'PATCH') {
          const start = dateValue(body.start_time || row.start_time, 'start_time'), end = dateValue(body.end_time || row.end_time, 'end_time');
          interval(start, end);
          if (start <= store.now()) invalid('start_time', 'Choose a future slot.');
          if (d.slots.some((other) => other !== row && other.mentor_id === viewer.user_id && overlap(start, end, other.start_time, other.end_time))) fail('SLOT_OVERLAP', 'This overlaps another sample slot.');
          Object.assign(row, { start_time: start, end_time: end, is_available: body.is_available ?? row.is_available });
          return ok(v.slot(row));
        }
      }
    }

    if (resource === 'mentors' && method === 'GET') {
      if (id === 'me' && action === 'dashboard') { store.requireUser(['mentor']); return ok(v.mentorDashboard(viewer)); }
      if (id && id !== 'recommended') {
        const profile = found(v.mentorProfile(id));
        if (viewer.role !== 'admin' && viewer.user_id !== id && (profile.profile_status !== 'approved' || v.user(id)?.account_status !== 'active')) fail('NOT_FOUND', 'This sample profile is not public.', 404);
        if (action === 'availability') return list(v.openSlots(id).filter((row) => (!params.from || row.end_time >= params.from) && (!params.to || row.start_time <= params.to)).map(v.slot), { ...params, page_size: 50 });
        return ok(profile);
      }
      let rows = d.mentors.filter((row) => row.profile_status === 'approved' && v.user(row.mentor_id)?.account_status === 'active').map((row) => v.mentorProfile(row.mentor_id));
      if (id === 'recommended') {
        store.requireUser(['student']);
        const profile = found(v.student(viewer.user_id));
        if (!profile.profile_completed) fail('PROFILE_INCOMPLETE', 'Complete the sample profile to see recommendations.');
        rows = rows.filter((row) => row.accepting_mentees).map((row) => {
          const sharedSkills = profile.skills.filter((skill) => row.expertise.some((expert) => expert.skill_id === skill.skill_id)).length;
          const sharedInterests = profile.interest_ids.filter((interest) => row.interest_ids.includes(interest)).length;
          const skills = 100 * sharedSkills / (profile.skills.length || 1), interests = 100 * sharedInterests / (profile.interest_ids.length || 1);
          const availability = Math.min(100, row.open_slots_14d * 20);
          return { mentor: row, match_score: Math.round(skills * 0.5 + interests * 0.3 + availability * 0.2),
            breakdown: { skills, interests, availability }, reasons: [`${sharedSkills} shared sample skills`, `${sharedInterests} shared career interests`, 'Illustrative local matching score.'] };
        }).sort((a, b) => b.match_score - a.match_score);
        return list(rows, params);
      }
      rows = rows.filter((row) => (!params.q || contains(`${row.full_name} ${row.professional_title} ${row.organisation} ${row.bio}`, params.q))
        && (!params.mentor_type || row.mentor_type === params.mentor_type)
        && (!params.skill_id || [params.skill_id].flat().every((key) => row.expertise.some((item) => item.skill_id === key)))
        && (!params.interest_id || [params.interest_id].flat().every((key) => row.interest_ids.includes(key)))
        && (!params.min_experience || row.experience_years >= Number(params.min_experience))
        && (params.accepting === false || row.accepting_mentees));
      if (['experience', 'experience_desc'].includes(params.sort)) rows.sort((a, b) => b.experience_years - a.experience_years);
      if (params.sort === 'name') rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
      if (params.sort === 'rating_desc' || params.sort === 'reviews_desc') rows.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
      return list(rows, params);
    }

    if (resource === 'students' && id === 'me' && action === 'dashboard' && method === 'GET') {
      store.requireUser(['student']); return ok(v.studentDashboard(viewer));
    }

    if (resource === 'mentoring-requests') {
      if (method === 'GET' && id === 'mine') return list(d.requests.filter((row) => v.own(row, viewer) && matches(row, params, ['status'])).map(v.request), params);
      if (method === 'POST' && !id) {
        store.requireUser(['student']);
        if (!v.student(viewer.user_id)?.profile_completed) fail('PROFILE_INCOMPLETE', 'Complete your sample profile first.');
        mentorAvailable(body.mentor_id);
        length(body.career_goal, 'career_goal', 20, 1000);
        if (body.message) length(body.message, 'message', 0, 1500);
        if (d.requests.some((row) => row.student_id === viewer.user_id && row.mentor_id === body.mentor_id && row.status === 'pending')) fail('DUPLICATE_PENDING_REQUEST', 'You already have a pending sample request to this mentor.');
        if (d.mentorships.some((row) => row.student_id === viewer.user_id && row.mentor_id === body.mentor_id && row.status === 'active')) fail('ACTIVE_MENTORSHIP_EXISTS', 'This sample mentorship is already active.');
        if (d.requests.filter((row) => row.student_id === viewer.user_id && row.status === 'pending').length >= 3) fail('PENDING_LIMIT_REACHED', 'Keep at most three pending sample requests.');
        if (d.requests.some((row) => row.student_id === viewer.user_id && row.mentor_id === body.mentor_id && row.status === 'declined' && Date.parse(row.responded_at) + 14 * 86400000 > Date.parse(store.now()))) fail('REQUEST_COOLDOWN', 'The sample 14-day cooldown is still active.');
        const row = { request_id: store.id('request'), student_id: viewer.user_id, mentor_id: body.mentor_id,
          career_goal: body.career_goal.trim(), message: body.message?.trim() || null, status: 'pending', status_reason: null,
          created_at: store.now(), responded_at: null, expires_at: new Date(Date.parse(store.now()) + 14 * 86400000).toISOString() };
        d.requests.unshift(row); notify(row.mentor_id, 'Mentoring request received', 'request_received', 'mentoring_request', row.request_id);
        audit('demo.request.created', 'mentoring_request', row.request_id); return ok(v.request(row));
      }
      const row = owns(d.requests.find((item) => item.request_id === id), viewer);
      if (method === 'GET') return ok(v.request(row));
      if (method === 'POST' && ['accept', 'decline', 'cancel'].includes(action)) {
        pending(row);
        if (body.reason) length(body.reason, 'reason', 0, 1000);
        if (action === 'cancel') { store.requireUser(['student']); if (row.student_id !== viewer.user_id) fail('FORBIDDEN', 'Only the requesting demo student can cancel.', 403); }
        else { store.requireUser(['mentor']); if (row.mentor_id !== viewer.user_id) fail('FORBIDDEN', 'Only the addressed demo mentor can decide.', 403); }
        if (action === 'accept') {
          mentorAvailable(viewer.user_id);
          if (row.expires_at <= store.now()) fail('INVALID_STATE_TRANSITION', 'This sample request has expired.');
          if (d.mentorships.some((item) => item.student_id === row.student_id && item.mentor_id === row.mentor_id && item.status === 'active')) fail('ACTIVE_MENTORSHIP_EXISTS', 'A sample mentorship already exists.');
        }
        row.status = { accept: 'accepted', decline: 'declined', cancel: 'cancelled' }[action]; row.responded_at = store.now(); row.status_reason = body.reason || null;
        if (action === 'accept') {
          const relationship = { mentorship_id: store.id('mentorship'), request_id: row.request_id, student_id: row.student_id, mentor_id: row.mentor_id,
            status: 'active', started_at: store.now(), created_at: store.now(), ended_at: null, end_reason: null };
          d.mentorships.unshift(relationship); notify(row.student_id, 'Request accepted', 'request_accepted', 'mentorship', relationship.mentorship_id);
          audit('demo.request.accepted', 'mentoring_request', row.request_id); return ok({ request: v.request(row), mentorship: v.mentorship(relationship) });
        }
        notify(action === 'cancel' ? row.mentor_id : row.student_id, `Request ${row.status}`, `request_${row.status}`, 'mentoring_request', row.request_id);
        audit(`demo.request.${row.status}`, 'mentoring_request', row.request_id); return ok(v.request(row));
      }
    }

    if (resource === 'mentorships') {
      if (method === 'GET' && !id) return list(d.mentorships.filter((row) => v.own(row, viewer) && matches(row, params, ['status'])).map(v.mentorship), params);
      const row = owns(d.mentorships.find((item) => item.mentorship_id === id), viewer);
      if (method === 'GET' && !action) return ok(v.mentorship(row));
      if (method === 'PATCH' && !action) {
        active(row);
        if (!['ended', 'completed'].includes(body.status)) invalid('status', 'Choose ended or completed.');
        if (body.status === 'ended' && !body.reason?.trim()) invalid('reason', 'Give a reason when ending early.');
        if (body.reason) length(body.reason, 'reason', 0, 1000);
        Object.assign(row, { status: body.status, ended_at: store.now(), end_reason: body.reason || null });
        d.sessions.filter((item) => item.mentorship_id === id && item.status === 'scheduled' && item.scheduled_end > store.now()).forEach((item) => { item.status = 'cancelled'; item.cancel_reason = 'Sample mentorship closed.'; });
        [row.student_id, row.mentor_id].forEach((userId) => notify(userId, 'Mentorship closed', 'mentorship_ended', 'mentorship', id));
        audit('demo.mentorship.closed', 'mentorship', id); return ok(v.mentorship(row));
      }
      if (action === 'sessions' && method === 'GET') return list(d.sessions.filter((item) => item.mentorship_id === id && matches(item, params, ['status'])).map((item) => v.session(item, viewer)), params);
      if (action === 'sessions' && method === 'POST') {
        editable(row, viewer); active(row);
        let slot;
        if (body.slot_id) {
          slot = found(d.slots.find((item) => item.slot_id === body.slot_id && item.mentor_id === row.mentor_id));
          if (!slot.is_available || v.slot(slot).booked || slot.start_time <= store.now()) fail('SLOT_UNAVAILABLE', 'Choose an open future sample slot.');
        } else if (viewer.role !== 'mentor') fail('FORBIDDEN', 'Demo students book published slots.', 403);
        const start = dateValue(slot?.start_time || body.scheduled_start, 'scheduled_start'), end = dateValue(slot?.end_time || body.scheduled_end, 'scheduled_end');
        interval(start, end); if (start <= store.now()) invalid('scheduled_start', 'Choose a future session.');
        if (!['online', 'phone', 'in_person'].includes(body.meeting_mode || 'online')) invalid('meeting_mode', 'Choose a meeting mode.');
        const session = { session_id: store.id('session'), mentorship_id: id, student_id: row.student_id, mentor_id: row.mentor_id,
          slot_id: slot?.slot_id || null, scheduled_start: start, scheduled_end: end, status: 'scheduled',
          meeting_mode: body.meeting_mode || 'online', meeting_link: body.meeting_link || '', notes: body.notes || '', created_at: store.now() };
        if (sessionConflict(session)) fail('SESSION_CONFLICT', 'One of the demo participants already has a session at that time.');
        d.sessions.unshift(session); [row.student_id, row.mentor_id].forEach((userId) => notify(userId, 'Session scheduled', 'session_scheduled', 'session', session.session_id));
        return ok(v.session(session, viewer));
      }
    }

    if (resource === 'sessions') {
      if (method === 'GET' && !id) return list(d.sessions.filter((row) => v.own(row, viewer) && matches(row, params, ['status'])
        && (!params.from || row.scheduled_end >= params.from) && (!params.to || row.scheduled_start <= params.to)).map((row) => v.session(row, viewer)), params);
      const row = owns(d.sessions.find((item) => item.session_id === id), viewer);
      if (method === 'GET' && !action) return ok(v.session(row, viewer));
      if (method === 'PATCH' && !action) {
        editable(row, viewer);
        if (viewer.role !== 'mentor' && (body.status !== 'cancelled' || Object.keys(body).some((key) => !['status', 'cancel_reason'].includes(key)))) fail('FORBIDDEN', 'Demo students may only cancel a session.', 403);
        if (body.status && !['completed', 'cancelled'].includes(body.status)) invalid('status', 'Choose completed or cancelled.');
        if (body.status && row.status !== 'scheduled') fail('INVALID_STATE_TRANSITION', 'This sample session is already closed.');
        if (body.status === 'completed' && (viewer.role !== 'mentor' || row.scheduled_start > store.now())) fail('INVALID_STATE_TRANSITION', 'The demo mentor can complete a session only after its start.');
        ['status', 'meeting_mode', 'meeting_link', 'notes', 'cancel_reason'].forEach((key) => { if (body[key] !== undefined) row[key] = body[key]; });
        if (row.status === 'cancelled') [row.student_id, row.mentor_id].forEach((userId) => notify(userId, 'Session cancelled', 'session_cancelled', 'session', id));
        return ok(v.session(row, viewer));
      }
      if (action === 'feedback' && method === 'GET') return list(d.feedback.filter((item) => item.session_id === id).map(v.feedback), params);
      if (action === 'feedback' && method === 'POST') {
        editable(row, viewer);
        if (row.status !== 'completed' || Date.parse(store.now()) > Date.parse(row.scheduled_end) + 14 * 86400000) fail('FEEDBACK_NOT_ALLOWED', 'Review a completed sample session within 14 days.');
        length((body.comments || '').trim(), 'comments', 10, 1000);
        if (d.feedback.some((item) => item.session_id === id && item.submitted_by === viewer.user_id)) fail('FEEDBACK_ALREADY_SUBMITTED', 'You have already reviewed this sample session.');
        const item = { feedback_id: store.id('feedback'), session_id: id, submitted_by: viewer.user_id, comments: body.comments.trim(), created_at: store.now() };
        d.feedback.push(item); return ok(v.feedback(item));
      }
    }

    if (resource === 'notifications') {
      const rows = v.notifications(viewer.user_id);
      if (method === 'GET' && !id) return { ...list(rows.filter((row) => params.is_read === undefined || row.is_read === params.is_read), params, { unread_count: v.unread(viewer.user_id) }), unread_count: v.unread(viewer.user_id) };
      if (method === 'POST' && id === 'mark-all-read') { rows.forEach((row) => { row.is_read = true; row.read_at = store.now(); }); return {}; }
      if (method === 'PATCH') { const row = found(rows.find((item) => item.notification_id === id)); row.is_read = true; row.read_at = store.now(); return ok(row); }
    }

    if (resource === 'admin') {
      store.requireUser(['admin']);
      if (id === 'users' && method === 'GET') return list(d.users.filter((row) => matches(row, params, ['role', 'account_status']) && contains(`${row.full_name} ${row.email}`, params.q)).map(v.userRow), params);
      if (id === 'users' && method === 'PATCH' && parts[3] === 'status') {
        const row = found(v.user(action));
        if (row.user_id === viewer.user_id) fail('FORBIDDEN', 'The demo administrator cannot disable their own account.', 403);
        if (!['active', 'suspended', 'deactivated'].includes(body.account_status)) invalid('account_status', 'Choose a valid account state.');
        row.account_status = body.account_status;
        if (row.role === 'mentor' && row.account_status !== 'active') cancelPending(row.user_id);
        notify(row.user_id, 'Account state changed', 'account_status_changed', 'user', row.user_id);
        audit(`demo.user.${body.account_status}`, 'user', row.user_id, { reason: body.reason || '' }); return ok(v.userRow(row));
      }
      if (id === 'mentors' && method === 'GET') return list(d.mentors.filter((row) => matches(row, params, ['profile_status']))
        .map((row) => v.mentorProfile(row.mentor_id)).filter((row) => contains(`${row.full_name} ${row.organisation} ${row.professional_title}`, params.q)), params);
      if (id === 'mentors' && method === 'PATCH' && parts[3] === 'approval') {
        const row = found(v.mentor(action));
        const status = { approve: 'approved', reject: 'rejected', suspend: 'suspended' }[body.decision];
        if (!status) invalid('decision', 'Choose approve, reject or suspend.');
        if (body.decision === 'reject' && !body.note?.trim()) invalid('note', 'Give a sample rejection note.');
        row.profile_status = status; row.review_note = body.note || null; row.reviewed_at = store.now();
        if (status === 'suspended') cancelPending(action);
        notify(action, `Profile ${status}`, 'mentor_reviewed', 'mentor_profile', action);
        audit(`demo.mentor.${status}`, 'mentor_profile', action, { note: body.note || '' }); return ok(v.mentorProfile(action));
      }
      if (id === 'mentorships' && method === 'GET') return list(d.mentorships.filter((row) => matches(row, params, ['status', 'student_id', 'mentor_id'])).map(v.mentorship), params);
      if (id === 'mentoring-requests' && method === 'GET') return list(d.requests.filter((row) => matches(row, params, ['status'])
        && (!params.older_than_days || Date.parse(row.created_at) <= Date.parse(store.now()) - Number(params.older_than_days) * 86400000)).map(v.request), params);
      if (id === 'audit-logs' && method === 'GET') return list(d.audit.filter((row) => matches(row, params, ['action', 'entity_type', 'entity_id', 'actor_user_id'])), params);
      if (id === 'analytics' && method === 'GET') {
        if (params.from && params.to && params.from > params.to) invalid('to', 'The end date must be on or after the start date.');
        if (action === 'overview') return ok(analytics.overview(params));
        if (action === 'trends') return ok(analytics.trends(params));
        if (action === 'export') return ok(exportCsv(params));
      }
      if (['skills', 'career-interests'].includes(id) && ['POST', 'PATCH'].includes(method)) {
        const isSkill = id === 'skills', rows = isSkill ? d.skills : d.interests;
        const key = isSkill ? 'skill_id' : 'interest_id', label = isSkill ? 'skill_name' : 'interest_name';
        const row = method === 'PATCH' ? found(rows.find((item) => item[key] === action)) : { [key]: store.id(isSkill ? 'skill' : 'interest'), is_active: true };
        if (body[label] !== undefined || method === 'POST') {
          length(body[label], label, 1, 100);
          if (rows.some((item) => item !== row && item[label].toLowerCase() === body[label].trim().toLowerCase())) fail('DUPLICATE_ENTRY', 'This sample catalogue entry already exists.');
        }
        [label, isSkill ? 'category' : 'description', 'is_active'].forEach((field) => { if (body[field] !== undefined) row[field] = body[field]; });
        if (method === 'POST') rows.push(row);
        audit('demo.catalogue.changed', id, row[key]); return ok(row);
      }
    }
    fail('DEMO_ACTION_UNAVAILABLE', 'This action is presentation-only in the local demonstration.', 501);
  }

  function cancelPending(mentorId) {
    store.data.requests.filter((row) => row.mentor_id === mentorId && row.status === 'pending').forEach((row) => {
      row.status = 'cancelled'; row.status_reason = 'Sample mentor made unavailable.'; row.responded_at = store.now();
      notify(row.student_id, 'Request cancelled', 'request_cancelled', 'mentoring_request', row.request_id);
    });
  }

  function exportCsv(params) {
    const d = store.data;
    const fields = { requests: ['request_id', 'student_id', 'mentor_id', 'status', 'created_at'],
      mentorships: ['mentorship_id', 'student_id', 'mentor_id', 'status', 'started_at'],
      sessions: ['session_id', 'mentorship_id', 'scheduled_start', 'status'],
      participation: ['mentor_id', 'active_mentees', 'sessions_completed', 'review_count'] };
    const keys = fields[params.report]; if (!keys) invalid('report', 'Choose an existing demo report.');
    const source = params.report === 'participation' ? d.mentors.map((row) => ({ mentor_id: row.mentor_id, active_mentees: v.countActive(row.mentor_id),
      sessions_completed: d.sessions.filter((item) => item.mentor_id === row.mentor_id && item.status === 'completed').length, review_count: v.reviewCount(row.mentor_id) }))
      : d[{ requests: 'requests', mentorships: 'mentorships', sessions: 'sessions' }[params.report]].filter((row) => (!params.from || row.created_at >= params.from) && (!params.to || row.created_at < `${params.to}T23:59:59.999Z`));
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    audit('demo.csv.exported', 'report', params.report);
    return { filename: `demo-${params.report}.csv`, content: [keys.join(','), ...source.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\r\n') };
  }

  return {
    store,
    async request(method, path, body, params) {
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('://') || path.startsWith('/api/')) fail('DEMO_ACTION_UNAVAILABLE', 'Only local demo resource keys are accepted.', 400);
      // Await the same interface as the old HTTP client; no fetch/XHR/Axios is used.
      return store.transaction(() => route(method.toUpperCase(), path, body ?? {}, params ?? {}));
    },
  };
}

let defaultService;
export const demoRequest = (...args) => {
  defaultService ||= createDemoService();
  return defaultService.request(...args);
};
