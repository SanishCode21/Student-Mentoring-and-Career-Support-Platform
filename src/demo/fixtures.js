/** Fictional data only. Relative dates keep the existing calendars useful. */
export const DEMO_PASSWORD = 'demo-only-123';
export const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'student@demo.test' },
  { label: 'Mentor', email: 'mentor@demo.test' },
  { label: 'Administrator', email: 'admin@demo.test' },
];

export function createFixtures(clock = new Date()) {
  const date = (days = 0, hour = 10) => {
    const value = new Date(clock);
    value.setDate(value.getDate() + days);
    value.setHours(hour, 0, 0, 0);
    return value.toISOString();
  };
  const users = [
    ['student-demo', 'Demo Student', 'student@demo.test', 'student'],
    ['student-two', 'Sample Learner', 'learner@demo.test', 'student'],
    ['student-new', 'New Learner', 'new-learner@demo.test', 'student'],
    ['mentor-demo', 'Demo Mentor', 'mentor@demo.test', 'mentor'],
    ['mentor-two', 'Research Mentor', 'research@demo.test', 'mentor'],
    ['mentor-pending', 'Applicant Mentor', 'applicant@demo.test', 'mentor'],
    ['mentor-paused', 'Paused Mentor', 'paused@demo.test', 'mentor'],
    ['mentor-three', 'Career Mentor', 'careers@demo.test', 'mentor'],
    ['admin-demo', 'Demo Administrator', 'admin@demo.test', 'admin'],
  ].map(([user_id, full_name, email, role]) => ({
    user_id, full_name, email, role, account_status: 'active', email_verified: false,
    created_at: date(-25), last_login_at: date(-1),
  }));
  const skills = [
    ['skill-python', 'Python', 'Programming'], ['skill-sql', 'SQL', 'Data'],
    ['skill-react', 'React', 'Web'], ['skill-communication', 'Communication', 'Professional'],
    ['skill-research', 'Research Methods', 'Academic'], ['skill-retired', 'Legacy Tool', 'Other'],
  ].map(([skill_id, skill_name, category]) => ({ skill_id, skill_name, category, is_active: skill_id !== 'skill-retired' }));
  const interests = [
    ['interest-data', 'Data Science'], ['interest-software', 'Software Development'],
    ['interest-studies', 'Higher Studies'], ['interest-startup', 'Entrepreneurship'],
  ].map(([interest_id, interest_name]) => ({ interest_id, interest_name, description: `Sample ${interest_name} pathway.`, is_active: true }));
  const students = users.filter((user) => user.role === 'student').map((user) => ({
    user_id: user.user_id, student_profile_id: `profile-${user.user_id}`,
    programme_stage: 'bs_degree', expected_graduation_year: clock.getFullYear() + 1,
    bio: 'Fictional student exploring career options through this local demonstration.',
    career_goals: 'Build a project portfolio and prepare for a software or data career.',
    guidance_needs: 'Portfolio feedback and interview preparation.', profile_completed: true,
    skills: [{ skill_id: 'skill-python', proficiency_level: 'intermediate', is_focus: true },
      { skill_id: 'skill-sql', proficiency_level: 'beginner', is_focus: true }],
    interest_ids: ['interest-data', 'interest-software'],
  }));
  const mentors = users.filter((user) => user.role === 'mentor').map((user, index) => ({
    mentor_id: user.user_id, mentor_type: index % 2 ? 'recent_graduate' : 'alumni',
    professional_title: index === 1 ? 'Research Associate' : 'Software Engineer',
    organisation: 'Fictional Example Organisation', experience_years: index + 3,
    graduation_year: clock.getFullYear() - index - 2, linkedin_url: '',
    bio: 'Fictional volunteer offering sample guidance on projects, careers and study pathways.',
    is_available: user.user_id !== 'mentor-paused', max_active_mentees: 3,
    profile_status: user.user_id === 'mentor-pending' ? 'pending_review' : 'approved',
    expertise: [{ skill_id: 'skill-python', expertise_level: 'expert' },
      { skill_id: 'skill-sql', expertise_level: 'advanced' }],
    interest_ids: index === 1 ? ['interest-studies', 'interest-data'] : ['interest-data', 'interest-software'],
    review_note: null, reviewed_at: user.user_id === 'mentor-pending' ? null : date(-20), created_at: date(-25),
  }));
  const requests = [
    { request_id: 'request-active', student_id: 'student-demo', mentor_id: 'mentor-demo', status: 'accepted', created_at: date(-12), responded_at: date(-11) },
    { request_id: 'request-pending', student_id: 'student-two', mentor_id: 'mentor-demo', status: 'pending', created_at: date(-2), responded_at: null },
    { request_id: 'request-student', student_id: 'student-demo', mentor_id: 'mentor-two', status: 'pending', created_at: date(-1), responded_at: null },
    { request_id: 'request-stale', student_id: 'student-new', mentor_id: 'mentor-two', status: 'pending', created_at: date(-11), responded_at: null },
    { request_id: 'request-declined', student_id: 'student-new', mentor_id: 'mentor-demo', status: 'declined', created_at: date(-13), responded_at: date(-12) },
  ].map((row) => ({ ...row, career_goal: 'Please review my sample project portfolio and help plan my next learning steps.',
    message: 'This is a fictional request for the Milestone 2 demonstration.', status_reason: null,
    expires_at: new Date(new Date(row.created_at).getTime() + 14 * 86400000).toISOString() }));
  const mentorships = [{ mentorship_id: 'mentorship-demo', request_id: 'request-active',
    student_id: 'student-demo', mentor_id: 'mentor-demo', status: 'active', started_at: date(-11),
    created_at: date(-11), ended_at: null, end_reason: null }];
  const slots = mentors.flatMap((mentor) => [1, 2, 3, 5, 7].map((day) => ({
    slot_id: `slot-${mentor.mentor_id}-${day}`, mentor_id: mentor.mentor_id,
    start_time: date(day, 10), end_time: date(day, 11), is_available: true,
  })));
  const sessions = [
    { session_id: 'session-upcoming', slot_id: 'slot-mentor-demo-1', scheduled_start: date(1, 10), scheduled_end: date(1, 11), status: 'scheduled' },
    { session_id: 'session-completed', slot_id: null, scheduled_start: date(-2, 10), scheduled_end: date(-2, 11), status: 'completed' },
    { session_id: 'session-rateable', slot_id: null, scheduled_start: date(-1, 10), scheduled_end: date(-1, 11), status: 'completed' },
    { session_id: 'session-ready', slot_id: null, scheduled_start: new Date(clock.getTime() - 2 * 3600000).toISOString(), scheduled_end: new Date(clock.getTime() - 3600000).toISOString(), status: 'scheduled' },
    { session_id: 'session-cancelled', slot_id: null, scheduled_start: date(-4, 10), scheduled_end: date(-4, 11), status: 'cancelled' },
  ].map((row) => ({ ...row, mentorship_id: 'mentorship-demo', student_id: 'student-demo', mentor_id: 'mentor-demo',
    meeting_mode: 'online', meeting_link: 'https://example.invalid/demo-meeting', notes: 'Sample agenda: review a portfolio project and agree the next steps.',
    cancel_reason: row.status === 'cancelled' ? 'Sample cancellation.' : null, created_at: date(-5) }));
  const feedback = [{ feedback_id: 'feedback-demo', session_id: 'session-completed', submitted_by: 'student-demo',
    rating: 5, comments: 'Sample feedback: the next steps were clear.', created_at: date(-2, 12) }];
  const notifications = [
    ['student-demo', 'Sample mentorship accepted', 'request_accepted', 'mentorship', 'mentorship-demo'],
    ['student-demo', 'Sample session scheduled', 'session_scheduled', 'session', 'session-upcoming'],
    ['mentor-demo', 'Sample request received', 'request_received', 'mentoring_request', 'request-pending'],
    ['mentor-pending', 'Sample application awaiting review', 'mentor_reviewed', 'mentor_profile', 'mentor-pending'],
  ].map(([user_id, title, notification_type, related_entity_type, related_entity_id], index) => ({
    notification_id: `notification-${index}`, user_id, title,
    message: 'Local demo record only. No email or external notification was sent.',
    notification_type, related_entity_type, related_entity_id, is_read: false, read_at: null, created_at: date(-1, 12),
  }));
  return { users, skills, interests, students, mentors, requests, mentorships, slots, sessions, feedback, notifications,
    audit: [{ audit_id: 'audit-demo', actor_user_id: 'admin-demo', action: 'demo.initialised',
      entity_type: 'demo', entity_id: 'local', details: { note: 'Fictional local sample data.' }, created_at: date(-1) }] };
}
