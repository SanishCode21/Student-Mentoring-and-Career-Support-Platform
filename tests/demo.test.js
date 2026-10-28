import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createDemoStore, DATA_KEY, SESSION_KEY } from '../src/demo/store.js';
import { createDemoService } from '../src/demo/service.js';

const clock = () => new Date('2026-10-28T10:00:00Z');
const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
function setup(memory = storage()) {
  const service = createDemoService(createDemoStore(memory, clock));
  const req = (method, path, body, params) => service.request(method, path, body, params);
  const login = (role = 'student') => req('POST', '/auth/login', { email: `${role}@demo.test`, password: 'demo-only-123' });
  return { service, req, login, memory };
}
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error.code === code);

test('all three demo roles can sign in and restore without storing passwords or tokens', async () => {
  const { req, login, memory } = setup();
  for (const role of ['student', 'mentor', 'admin']) {
    const result = await login(role);
    assert.equal(result.data.user.role, role);
    assert.equal(result.data.access_token, undefined);
    const restored = setup(memory);
    assert.equal((await restored.req('POST', '/auth/refresh')).data.user.role, role);
    assert.equal(memory.getItem(SESSION_KEY), `${role}-demo`);
    assert.doesNotMatch(memory.getItem(DATA_KEY), /demo-only-123|password_hash|access_token|refresh_token/);
    await req('POST', '/auth/logout');
    await rejectsCode(req('GET', '/users/me'), 'UNAUTHENTICATED');
  }
});

test('role boundaries, suspension and record ownership are enforced locally', async () => {
  const { req, login } = setup();
  await login();
  await rejectsCode(req('GET', '/admin/users'), 'FORBIDDEN');
  await rejectsCode(req('GET', '/mentors/me/profile'), 'FORBIDDEN');
  await rejectsCode(req('GET', '/mentoring-requests/request-pending'), 'NOT_FOUND');
  await login('admin');
  await req('PATCH', '/admin/users/student-demo/status', { account_status: 'suspended', reason: 'Sample test' });
  await rejectsCode(login(), 'ACCOUNT_SUSPENDED');
  await req('PATCH', '/admin/users/student-demo/status', { account_status: 'active' });
  await login();
});

test('profile edits persist and student, mentor and catalogue fields retain screen-facing shapes', async () => {
  const { req, login, memory } = setup();
  await login();
  const result = await req('PATCH', '/students/me/profile', { full_name: 'Edited Demo Student', bio: 'Edited locally.' });
  assert.equal(result.data.full_name, 'Edited Demo Student');
  assert.equal(result.data.skills[0].skill_name, 'Python');
  assert.equal(result.data.interests[0].interest_name, 'Data Science');
  const restored = setup(memory);
  assert.equal((await restored.req('GET', '/students/me/profile')).data.bio, 'Edited locally.');
  await login('mentor');
  assert.equal((await req('GET', '/mentors/me/profile')).data.full_name, 'Demo Mentor');
  assert.ok((await req('GET', '/skills')).meta.total > 0);
});

test('mentor discovery filters, sorts, recommendations and pagination use local records', async () => {
  const { req, login } = setup(); await login();
  const result = await req('GET', '/mentors', null, { q: 'Research', page_size: 1 });
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].mentor_id, 'mentor-two');
  assert.ok((await req('GET', '/mentors/recommended')).data[0].reasons.length);
  assert.equal((await req('GET', '/mentors', null, { skill_id: 'missing' })).data.length, 0);
  const sorted = await req('GET', '/mentors', null, { accepting: false, sort: 'name' });
  assert.deepEqual(sorted.data.map((row) => row.full_name), sorted.data.map((row) => row.full_name).sort());
  const paged = await req('GET', '/mentors', null, { page: 2, page_size: 1 });
  assert.equal(paged.meta.page, 2); assert.equal(paged.data.length, 1);
});

test('a request can be submitted, seen by the mentor, accepted and seen as a student mentorship', async () => {
  const { req, service, login } = setup();
  await req('POST', '/auth/login', { email: 'learner@demo.test', password: 'demo-only-123' });
  // This learner already has a seeded request; cancel it, then demonstrate a fresh one.
  await req('POST', '/mentoring-requests/request-pending/cancel', { reason: 'Try a fresh demo request.' });
  const created = (await req('POST', '/mentoring-requests', { mentor_id: 'mentor-demo', career_goal: 'Please help review a sample software portfolio.' })).data;
  await rejectsCode(req('POST', '/mentoring-requests', { mentor_id: 'mentor-demo', career_goal: 'Please help review a sample software portfolio.' }), 'DUPLICATE_PENDING_REQUEST');
  await login('mentor');
  assert.ok((await req('GET', '/mentoring-requests/mine')).data.some((row) => row.request_id === created.request_id));
  const accepted = (await req('POST', `/mentoring-requests/${created.request_id}/accept`)).data;
  assert.equal(accepted.request.status, 'accepted');
  assert.equal(accepted.mentorship.status, 'active');
  await req('POST', '/auth/login', { email: 'learner@demo.test', password: 'demo-only-123' });
  assert.equal((await req('GET', `/mentorships/${accepted.mentorship.mentorship_id}`)).data.mentor_name, 'Demo Mentor');
  assert.ok(service.store.data.notifications.some((row) => row.user_id === 'student-two' && row.notification_type === 'request_accepted'));
});

test('decline and cancellation change lists and reject repeated state transitions', async () => {
  const { req, login } = setup();
  await login('mentor');
  assert.equal((await req('POST', '/mentoring-requests/request-pending/decline', { reason: 'Sample decline.' })).data.status, 'declined');
  await rejectsCode(req('POST', '/mentoring-requests/request-pending/accept'), 'INVALID_STATE_TRANSITION');
  await login();
  assert.equal((await req('POST', '/mentoring-requests/request-student/cancel')).data.status, 'cancelled');
});

test('availability supports add, edit, overlap rejection and delete with rollback', async () => {
  const { req, login, service } = setup(); await login('mentor');
  const body = { slots: [{ start_time: '2026-11-10T13:00:00Z', end_time: '2026-11-10T14:00:00Z' }] };
  const slot = (await req('POST', '/mentors/me/availability', body)).data[0];
  await rejectsCode(req('POST', '/mentors/me/availability', body), 'SLOT_OVERLAP');
  assert.equal((await req('PATCH', `/mentors/me/availability/${slot.slot_id}`, { is_available: false })).data.is_available, false);
  await req('DELETE', `/mentors/me/availability/${slot.slot_id}`);
  assert.ok(!service.store.data.slots.some((row) => row.slot_id === slot.slot_id));
  const before = service.store.data.slots.length;
  await rejectsCode(req('POST', '/mentors/me/availability', { slots: [body.slots[0], body.slots[0]] }), 'SLOT_OVERLAP');
  assert.equal(service.store.data.slots.length, before, 'failed multi-slot action must not save partial data');
});

test('recurring availability creates future local slots', async () => {
  const { req, login } = setup(); await login('mentor');
  const slots = (await req('POST', '/mentors/me/availability', { recurrence: { weekdays: [0, 2, 4], weeks: 2, start_time: '18:00', end_time: '19:00', zone: 'Asia/Calcutta' } })).data;
  assert.ok(slots.length >= 5); assert.ok(slots.every((row) => Date.parse(row.start_time) > clock().getTime()));
});

test('session booking prevents double booking, supports notes and cancellation, and releases slots', async () => {
  const { req, login } = setup(); await login();
  const body = { slot_id: 'slot-mentor-demo-2', notes: 'A local sample agenda.', meeting_mode: 'online' };
  const session = (await req('POST', '/mentorships/mentorship-demo/sessions', body)).data;
  await rejectsCode(req('POST', '/mentorships/mentorship-demo/sessions', body), 'SLOT_UNAVAILABLE');
  await login('mentor');
  assert.equal((await req('PATCH', `/sessions/${session.session_id}`, { notes: 'Updated sample notes.' })).data.notes, 'Updated sample notes.');
  await rejectsCode(req('PATCH', `/sessions/${session.session_id}`, { status: 'completed' }), 'INVALID_STATE_TRANSITION');
  await login();
  await req('PATCH', `/sessions/${session.session_id}`, { status: 'cancelled', cancel_reason: 'Demo cancellation.' });
  assert.ok((await req('GET', '/mentors/mentor-demo/availability')).data.some((row) => row.slot_id === body.slot_id));
});

test('mentor completes a started session and participants can rate once with refreshed summaries', async () => {
  const { req, login } = setup(); await login('mentor');
  assert.equal((await req('PATCH', '/sessions/session-ready', { status: 'completed' })).data.status, 'completed');
  await login();
  await req('POST', '/sessions/session-rateable/feedback', { rating: 4, comments: 'Sample feedback.' });
  await rejectsCode(req('POST', '/sessions/session-rateable/feedback', { rating: 4 }), 'FEEDBACK_ALREADY_SUBMITTED');
  assert.equal((await req('GET', '/sessions/session-rateable')).data.my_feedback_submitted, true);
  assert.equal((await req('GET', '/sessions/session-rateable/feedback')).data[0].rating, 4);
  assert.equal((await req('GET', '/mentors/mentor-demo')).data.rating.average, 4.5);
});

test('closing a mentorship cancels future sessions and prevents further booking', async () => {
  const { req, login } = setup(); await login();
  await req('PATCH', '/mentorships/mentorship-demo', { status: 'ended', reason: 'Sample early closure.' });
  assert.equal((await req('GET', '/sessions/session-upcoming')).data.status, 'cancelled');
  await rejectsCode(req('POST', '/mentorships/mentorship-demo/sessions', { slot_id: 'slot-mentor-demo-2' }), 'MENTORSHIP_NOT_ACTIVE');
});

test('local notifications mark-read and mark-all-read keep badge counts consistent', async () => {
  const { req, login } = setup(); await login();
  const initial = await req('GET', '/notifications'); assert.equal(initial.meta.unread_count, 2);
  await req('PATCH', `/notifications/${initial.data[0].notification_id}`, { is_read: true });
  assert.equal((await req('GET', '/notifications')).unread_count, 1);
  await req('POST', '/notifications/mark-all-read');
  assert.equal((await req('GET', '/notifications')).meta.unread_count, 0);
});

test('admin review, catalogue changes, audit, analytics and CSV operate on sample data', async () => {
  const { req, login } = setup(); await login('admin');
  assert.equal((await req('PATCH', '/admin/mentors/mentor-pending/approval', { decision: 'approve', note: 'Sample checklist.' })).data.profile_status, 'approved');
  const skill = (await req('POST', '/admin/skills', { skill_name: 'Demo Testing', category: 'Demo' })).data;
  assert.equal((await req('PATCH', `/admin/skills/${skill.skill_id}`, { is_active: false })).data.is_active, false);
  const interest = (await req('POST', '/admin/career-interests', { interest_name: 'Demo Path', description: 'Sample only.' })).data;
  await req('PATCH', `/admin/career-interests/${interest.interest_id}`, { is_active: false });
  assert.ok((await req('GET', '/admin/audit-logs')).meta.total > 1);
  const params = { from: '2026-10-01', to: '2026-10-31' };
  assert.equal((await req('GET', '/admin/analytics/overview', null, params)).data.users.students, 3);
  assert.ok((await req('GET', '/admin/analytics/trends', null, { ...params, metric: 'requests', interval: 'week' })).data.series.length);
  const csv = (await req('GET', '/admin/analytics/export', null, { ...params, report: 'requests' })).data;
  assert.match(csv.filename, /^demo-requests/); assert.match(csv.content, /request_id,student_id/);
});

test('registration/onboarding is local, passwords are presentation-only, and invalid records fail clearly', async () => {
  const { req, memory } = setup();
  await req('POST', '/auth/register', { full_name: 'Fictional New User', email: 'new@demo.test', password: 'sample-password-123', role: 'student' });
  const account = await req('POST', '/auth/login', { email: 'new@demo.test', password: 'any-demo-input-123' });
  assert.equal(account.data.user.profile_completed, false);
  const profile = await req('PATCH', '/students/me/profile', { programme_stage: 'bs_degree', career_goals: 'Build a sample portfolio.',
    skills: [{ skill_id: 'skill-python', proficiency_level: 'beginner', is_focus: true }], interest_ids: ['interest-data'] });
  assert.equal(profile.data.profile_completed, true);
  assert.equal((await req('POST', '/users/me/password', { current_password: 'sample', new_password: 'demo-password-123' })).data.demo_only, true);
  assert.doesNotMatch(memory.getItem(DATA_KEY), /sample-password-123|any-demo-input-123|demo-password-123/);
  assert.equal((await req('POST', '/auth/forgot-password', { email: 'new@demo.test' })).data.demo_only, true);
  assert.equal((await req('POST', '/auth/reset-password', { token: 'demo-preview', new_password: 'demo-password-123' })).data.demo_only, true);
  await rejectsCode(req('GET', '/mentorships/not-a-record'), 'NOT_FOUND');
  await rejectsCode(req('GET', '/unsupported-demo-action'), 'DEMO_ACTION_UNAVAILABLE');
  await rejectsCode(req('GET', 'https://example.test/api'), 'DEMO_ACTION_UNAVAILABLE');
});

test('storage errors/corruption fall back to usable fictional data', async () => {
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const { req, login } = setup(unavailable); await login();
  assert.equal((await req('GET', '/users/me')).data.role, 'student');
  const corrupt = storage(); corrupt.setItem(DATA_KEY, '{invalid');
  assert.equal(setup(corrupt).service.store.data.users.length, 9);
});

test('active source has no HTTP/data-service transport and the Vite proxy is removed', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(new URL(`${entry.name}/`, dir)) : [new URL(entry.name, dir)]);
  const files = walk(new URL('../src/', import.meta.url)).filter((file) => /\.(js|jsx|css)$/.test(file.pathname));
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bEventSource\s*\(|from\s+['"]axios['"]|import\s*\(\s*['"]axios['"]/,
      `unexpected network transport: ${file.pathname}`);
  }
  assert.doesNotMatch(readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /proxy\s*:/);
});
