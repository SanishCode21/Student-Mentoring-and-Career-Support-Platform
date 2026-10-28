/** Read models keep the original screen-facing response shapes in one place. */
export function createViews(store) {
  const d = () => store.data;
  const user = (id) => d().users.find((row) => row.user_id === id);
  const name = (id) => user(id)?.full_name || 'Demo participant';
  const student = (id) => d().students.find((row) => row.user_id === id);
  const mentor = (id) => d().mentors.find((row) => row.mentor_id === id);
  const countActive = (id) => d().mentorships.filter((row) => row.mentor_id === id && row.status === 'active').length;
  const skillRows = (rows) => rows.map((row) => ({ ...d().skills.find((skill) => skill.skill_id === row.skill_id), ...row }));
  const interestRows = (ids) => ids.map((id) => d().interests.find((row) => row.interest_id === id)).filter(Boolean);
  const own = (row, viewer) => viewer.role === 'admin' || row.student_id === viewer.user_id || row.mentor_id === viewer.user_id;
  const slot = (row) => ({ ...row, booked: d().sessions.some((session) => session.slot_id === row.slot_id && session.status === 'scheduled') });
  const openSlots = (id) => d().slots.filter((row) => row.mentor_id === id && row.is_available && row.start_time > store.now() && !slot(row).booked);
  const feedback = (row) => ({ ...row, submitted_by_name: name(row.submitted_by) });
  const rating = (id) => {
    const ids = d().sessions.filter((row) => row.mentor_id === id).map((row) => row.session_id);
    const rows = d().feedback.filter((row) => ids.includes(row.session_id) && user(row.submitted_by)?.role === 'student');
    return rows.length ? { average: Math.round(rows.reduce((sum, row) => sum + row.rating, 0) / rows.length * 100) / 100, count: rows.length } : null;
  };
  const studentProfile = (id) => {
    const row = student(id);
    return row ? { ...row, full_name: name(id), skills: skillRows(row.skills), interests: interestRows(row.interest_ids) } : null;
  };
  const mentorProfile = (id) => {
    const row = mentor(id);
    if (!row) return null;
    const active = countActive(id);
    return { ...row, full_name: name(id), email: user(id)?.email,
      expertise: skillRows(row.expertise), interests: interestRows(row.interest_ids), rating: rating(id),
      free_mentee_spots: Math.max(0, row.max_active_mentees - active), active_mentees: active,
      open_slots_14d: openSlots(id).filter((item) => Date.parse(item.start_time) <= Date.parse(store.now()) + 14 * 86400000).length,
      accepting_mentees: row.is_available && active < row.max_active_mentees && user(id)?.account_status === 'active',
      top_skills: skillRows(row.expertise).map((skill) => skill.skill_name),
    };
  };
  const userRow = (row) => ({ ...row, profile_completed: row.role === 'student' ? Boolean(student(row.user_id)?.profile_completed) : mentor(row.user_id)?.profile_status === 'approved',
    profile_status: row.role === 'mentor' ? mentor(row.user_id)?.profile_status : null });
  const request = (row) => {
    const profile = studentProfile(row.student_id);
    const relationship = d().mentorships.find((item) => item.request_id === row.request_id);
    return { ...row, student_name: name(row.student_id), mentor_name: name(row.mentor_id),
      ...(relationship ? { mentorship_id: relationship.mentorship_id } : {}),
      student_summary: profile ? { ...profile, interests: profile.interests.map((item) => item.interest_name) } : null };
  };
  const mentorship = (row) => {
    const sessions = d().sessions.filter((item) => item.mentorship_id === row.mentorship_id);
    const origin = d().requests.find((item) => item.request_id === row.request_id);
    return { ...row, student_name: name(row.student_id), mentor_name: name(row.mentor_id),
      career_goal: origin?.career_goal || '', originating_request: origin ? { request_id: origin.request_id, status: origin.status } : null,
      sessions_completed: sessions.filter((item) => item.status === 'completed').length,
      sessions_scheduled: sessions.filter((item) => item.status === 'scheduled').length,
      last_session_at: sessions.map((item) => item.scheduled_start).sort().at(-1) || null };
  };
  const session = (row, viewer) => ({ ...row, student_name: name(row.student_id), mentor_name: name(row.mentor_id),
    my_feedback_submitted: d().feedback.some((item) => item.session_id === row.session_id && item.submitted_by === viewer.user_id) });
  const notifications = (id) => d().notifications.filter((row) => row.user_id === id);
  const unread = (id) => notifications(id).filter((row) => !row.is_read).length;
  const studentDashboard = (viewer) => ({
    profile_completed: Boolean(student(viewer.user_id)?.profile_completed),
    pending_requests: d().requests.filter((row) => row.student_id === viewer.user_id && row.status === 'pending').length,
    active_mentorships: d().mentorships.filter((row) => row.student_id === viewer.user_id && row.status === 'active').length,
    next_session: d().sessions.filter((row) => row.student_id === viewer.user_id && row.status === 'scheduled' && row.scheduled_start > store.now())
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)).map((row) => session(row, viewer))[0] || null,
    unread_notifications: unread(viewer.user_id),
  });
  const mentorDashboard = (viewer) => ({
    profile_status: mentor(viewer.user_id)?.profile_status || 'draft',
    pending_requests: d().requests.filter((row) => row.mentor_id === viewer.user_id && row.status === 'pending').length,
    active_mentees: countActive(viewer.user_id), max_active_mentees: mentor(viewer.user_id)?.max_active_mentees || 3,
    upcoming_sessions: d().sessions.filter((row) => row.mentor_id === viewer.user_id && row.status === 'scheduled' && row.scheduled_start > store.now())
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)).slice(0, 5).map((row) => session(row, viewer)),
    rating_summary: rating(viewer.user_id), unread_notifications: unread(viewer.user_id),
  });
  return { user, name, student, mentor, countActive, own, slot, openSlots, feedback, rating,
    studentProfile, mentorProfile, userRow, request, mentorship, session, notifications, unread, studentDashboard, mentorDashboard };
}

export function paginate(rows, params = {}, extra = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(params.page_size) || 10));
  return { data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, page_size: pageSize, total: rows.length, total_pages: Math.ceil(rows.length / pageSize), ...extra } };
}
