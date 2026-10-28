/** Computed from the same fictional records used by the other screens. */
export function createAnalytics(store) {
  function range(params) {
    const from = new Date(params.from || store.now().slice(0, 10));
    const to = new Date(params.to || store.now().slice(0, 10));
    to.setUTCDate(to.getUTCDate() + 1);
    return (row, key = 'created_at') => Date.parse(row[key]) >= from.getTime() && Date.parse(row[key]) < to.getTime();
  }
  function overview(params) {
    const d = store.data;
    const inRange = range(params);
    const byStatus = (rows, states) => Object.fromEntries(states.map((status) => [status, rows.filter((row) => row.status === status).length]));
    const requests = byStatus(d.requests.filter((row) => inRange(row)), ['pending', 'accepted', 'declined', 'cancelled', 'expired']);
    const mentorships = byStatus(d.mentorships.filter((row) => inRange(row)), ['active', 'completed', 'ended']);
    const sessions = byStatus(d.sessions.filter((row) => inRange(row)), ['scheduled', 'completed', 'cancelled']);
    const feedback = d.feedback.filter((row) => inRange(row));
    const active = d.mentorships.filter((row) => row.status === 'active').length;
    const capacity = d.mentors.filter((row) => row.profile_status === 'approved').reduce((sum, row) => sum + row.max_active_mentees, 0);
    return {
      period: { from: params.from, to: params.to },
      users: Object.fromEntries([['students', 'student'], ['mentors', 'mentor'], ['admins', 'admin']].map(([key, role]) => [key, d.users.filter((row) => row.role === role && row.account_status === 'active').length])),
      mentors: { ...Object.fromEntries(['approved', 'pending_review', 'rejected', 'suspended', 'draft'].map((status) => [status, d.mentors.filter((row) => row.profile_status === status).length])),
        capacity_total: capacity, utilisation: capacity ? active / capacity : 0 },
      requests: { ...requests, total: Object.values(requests).reduce((a, b) => a + b, 0),
        acceptance_rate: requests.accepted / (requests.accepted + requests.declined || 1), median_response_hours: null },
      mentorships: { ...mentorships, with_three_or_more_sessions: d.mentorships.filter((row) => d.sessions.filter((item) => item.mentorship_id === row.mentorship_id && item.status === 'completed').length >= 3).length },
      sessions: { ...sessions, completion_rate: sessions.completed / (sessions.completed + sessions.cancelled || 1) },
      feedback: { count: feedback.filter((row) => row.comments?.trim()).length,
        recent_reviews: feedback.filter((row) => row.comments?.trim() && d.users.some((u) => u.user_id === row.submitted_by && u.role === 'student'))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20).map((row) => {
            const session = d.sessions.find((s) => s.session_id === row.session_id);
            return { feedback_id: row.feedback_id, student_name: d.users.find((u) => u.user_id === row.submitted_by)?.full_name || 'Student',
              mentor_name: d.users.find((u) => u.user_id === session?.mentor_id)?.full_name || 'Mentor',
              session_date: session?.scheduled_start, comments: row.comments, created_at: row.created_at };
          }) },
    };
  }
  function trends(params) {
    const d = store.data;
    const from = new Date(params.from || store.now());
    const to = new Date(params.to || store.now());
    const series = [];
    // Limit malformed stored/query ranges so a demo cannot accidentally hang a page.
    for (let start = from, i = 0; start <= to && i < 200; i += 1) {
      const end = new Date(start);
      if (params.interval === 'month') end.setMonth(end.getMonth() + 1); else end.setDate(end.getDate() + 7);
      const inBucket = (row, key = 'created_at') => Date.parse(row[key]) >= start.getTime() && Date.parse(row[key]) < end.getTime() && Date.parse(row[key]) < to.getTime() + 86400000;
      let rows;
      switch (params.metric) {
        case 'sessions': rows = d.sessions.filter((row) => inBucket(row)); break;
        case 'acceptances': rows = d.requests.filter((row) => row.status === 'accepted' && inBucket(row, 'responded_at')); break;
        case 'new_mentors': rows = d.mentors.filter((row) => inBucket(row)); break;
        case 'reviews': rows = d.feedback.filter((row) => inBucket(row) && row.comments?.trim()); break;
        case 'active_users': rows = d.users.filter((row) => inBucket(row, 'last_login_at')); break;
        default: rows = d.requests.filter((row) => inBucket(row));
      }
      series.push({ period_start: start.toISOString().slice(0, 10), value: rows.length });
      start = end;
    }
    return { metric: params.metric, interval: params.interval, series };
  }
  return { overview, trends };
}
