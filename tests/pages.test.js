import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemoStore } from '../src/demo/store.js';
import { createDemoService } from '../src/demo/service.js';

/** Logical page groups from the original frontend README, not a new route design. */
const groups = [
  ['1 Login', '/login'], ['2 Registration', '/register'], ['3 Password recovery', '/forgot-password'],
  ['4 Reset and errors', '/reset-password', '/session-expired', '/403', '/404', '/500'],
  ['5 Onboarding', '/student/onboarding'], ['6 Student dashboard', '/student/dashboard'],
  ['7 Discovery', '/student/mentors'], ['8 Mentor detail', '/student/mentors/:mentor_id'],
  ['9 Send request', '/student/mentors/:mentor_id/request'], ['10 Requests', '/student/requests'],
  ['11 Mentorship', '/student/mentorships', '/student/mentorships/:mentorship_id'],
  ['12 Sessions and feedback', '/student/mentorships/:mentorship_id/sessions'],
  ['13 Student profile', '/student/profile'], ['14 Student notifications', '/student/notifications'],
  ['15 Mentor dashboard', '/mentor/dashboard'], ['16 Incoming requests', '/mentor/requests'],
  ['17 Request detail', '/mentor/requests/:request_id'], ['18 Mentees', '/mentor/mentees'],
  ['19 Schedule', '/mentor/schedule'], ['20 Mentor profile', '/mentor/profile'],
  ['21 Mentor notifications', '/mentor/notifications'], ['22 Admin dashboard', '/admin/dashboard'],
  ['23 Users and catalogues', '/admin/users'], ['24 Mentor review', '/admin/mentors'],
  ['25 Oversight', '/admin/mentorships'], ['26 Analytics', '/admin/analytics'],
];

test('all 26 documented page groups still have their original declared routes', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.equal(groups.length, 26);
  for (const [label, ...paths] of groups) for (const path of paths) assert.ok(app.includes(`path="${path}"`), `${label}: missing ${path}`);
});

test('every page data dependency has a usable local response for its intended role', async () => {
  const service = createDemoService(createDemoStore(null));
  const req = (path, params) => service.request('GET', path, null, params);
  const login = (role) => service.request('POST', '/auth/login', { email: `${role}@demo.test`, password: 'demo-only-123' });
  const check = async (path, params) => {
    const response = await req(path, params);
    assert.notEqual(response.data, undefined, `no data for ${path}`);
    return response;
  };
  await login('student');
  for (const path of ['/users/me', '/students/me/profile', '/skills', '/career-interests', '/students/me/dashboard',
    '/mentors/recommended', '/mentors', '/mentors/mentor-demo', '/mentors/mentor-three', '/mentors/mentor-demo/availability',
    '/mentoring-requests/mine', '/mentoring-requests/request-student', '/mentorships', '/mentorships/mentorship-demo',
    '/mentorships/mentorship-demo/sessions', '/sessions/session-completed/feedback', '/notifications']) await check(path);
  await login('mentor');
  for (const path of ['/mentors/me/profile', '/mentors/me/dashboard', '/mentoring-requests/mine', '/mentoring-requests/request-pending',
    '/mentorships', '/mentorships/mentorship-demo', '/mentorships/mentorship-demo/sessions', '/sessions', '/mentors/me/availability', '/notifications']) await check(path);
  const profile = (await check('/mentors/me/profile')).data;
  assert.ok(Array.isArray(profile.expertise)); assert.ok(Array.isArray(profile.interests));
  const detail = (await check('/mentoring-requests/request-pending')).data;
  assert.ok(Array.isArray(detail.student_summary.skills));
  assert.ok(detail.student_summary.interests.every((interest) => typeof interest === 'string'));
  await login('admin');
  for (const path of ['/admin/users', '/admin/mentors', '/admin/mentorships', '/admin/mentoring-requests', '/admin/audit-logs', '/skills', '/career-interests']) await check(path);
  const params = { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
  const overview = (await check('/admin/analytics/overview', params)).data;
  for (const key of ['users', 'mentors', 'requests', 'mentorships', 'sessions', 'feedback']) assert.ok(overview[key]);
  await check('/admin/analytics/trends', { ...params, metric: 'requests', interval: 'week' });
  for (const report of ['requests', 'sessions', 'mentorships', 'participation']) {
    const exported = (await check('/admin/analytics/export', { ...params, report })).data;
    assert.ok(exported.content.length); assert.ok(exported.filename.endsWith('.csv'));
  }
});
