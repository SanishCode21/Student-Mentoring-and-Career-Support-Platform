import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getAll } from './api.js';
import { RequireAuth, homeFor, useAuth } from './auth.jsx';
import AppShell from './components/shell.jsx';
import {
  EmptyState, ErrorState, FullPageSpinner, Loading, PageHeader, Panel, useApi, useTitle,
} from './components/ui.jsx';
import {
  AdminAnalytics, AdminDashboard, AdminMentors, AdminMentorships, AdminUsers,
} from './pages/admin.jsx';
import {
  Mentees, MentorDashboard, MentorNotifications, MentorProfile, MentorRequestDetail,
  MentorRequests, MentorSchedule,
} from './pages/mentor.jsx';
import { ErrorPage, ForgotPassword, Login, Register, ResetPassword } from './pages/public.jsx';
import {
  MentorshipDetail, MentorshipSessions, MentorDetail, MentorDirectory, MyRequests, SendRequest,
  StudentDashboard, StudentNotifications, StudentOnboarding, StudentProfile,
} from './pages/student.jsx';

/* ------------------------------------------------------------------ glue */

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Landing() {
  const { user, ready } = useAuth();
  if (!ready) return <FullPageSpinner />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

/** `/student/mentorships` opens the active (or most recent) mentorship. */
function MentorshipEntry() {
  useTitle('My mentorship');
  const list = useApi(() => getAll('/mentorships'), []);

  if (list.loading) {
    return (
      <>
        <PageHeader title="My mentorship" subtitle="Loading your relationships…" />
        <Panel><Loading label="Loading mentorships…" rows={3} /></Panel>
      </>
    );
  }
  if (list.error) {
    return (
      <>
        <PageHeader title="My mentorship" />
        <ErrorState error={list.error} onRetry={list.reload} />
      </>
    );
  }

  const rows = list.data || [];
  const preferred = rows.find((row) => row.status === 'active') || rows[0];
  if (preferred) {
    return <Navigate to={`/student/mentorships/${preferred.mentorship_id}`} replace />;
  }

  return (
    <>
      <PageHeader
        title="My mentorship"
        subtitle="Once a mentor accepts your request the relationship appears here."
      />
      <Panel>
        <EmptyState
          icon="◎"
          title="No mentorship yet"
          action={<Link to="/student/mentors" className="btn btn-primary btn-sm">Find a mentor</Link>}
        >
          Send a goal-based request. If it is accepted, you can book sessions and keep notes here.
        </EmptyState>
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------ routes */

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/session-expired" element={<ErrorPage code={401} sessionExpired />} />
        <Route path="/403" element={<ErrorPage code={403} />} />
        <Route path="/404" element={<ErrorPage code={404} />} />
        <Route path="/500" element={<ErrorPage code={500} />} />

        {/* student */}
        <Route
          element={(
            <RequireAuth roles={['student']}>
              <AppShell />
            </RequireAuth>
          )}
        >
          <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="/student/onboarding" element={<StudentOnboarding />} />
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/mentors" element={<MentorDirectory />} />
          <Route path="/student/mentors/:mentor_id" element={<MentorDetail />} />
          <Route path="/student/mentors/:mentor_id/request" element={<SendRequest />} />
          <Route path="/student/requests" element={<MyRequests />} />
          <Route path="/student/mentorships" element={<MentorshipEntry />} />
          <Route path="/student/mentorships/:mentorship_id" element={<MentorshipDetail />} />
          <Route path="/student/mentorships/:mentorship_id/sessions" element={<MentorshipSessions />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/notifications" element={<StudentNotifications />} />
        </Route>

        {/* mentor */}
        <Route
          element={(
            <RequireAuth roles={['mentor']}>
              <AppShell />
            </RequireAuth>
          )}
        >
          <Route path="/mentor" element={<Navigate to="/mentor/dashboard" replace />} />
          <Route path="/mentor/dashboard" element={<MentorDashboard />} />
          <Route path="/mentor/requests" element={<MentorRequests />} />
          <Route path="/mentor/requests/:request_id" element={<MentorRequestDetail />} />
          <Route path="/mentor/mentees" element={<Mentees />} />
          <Route path="/mentor/schedule" element={<MentorSchedule />} />
          <Route path="/mentor/profile" element={<MentorProfile />} />
          <Route path="/mentor/notifications" element={<MentorNotifications />} />
        </Route>

        {/* admin */}
        <Route
          element={(
            <RequireAuth roles={['admin']}>
              <AppShell />
            </RequireAuth>
          )}
        >
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/mentors" element={<AdminMentors />} />
          <Route path="/admin/mentorships" element={<AdminMentorships />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
        </Route>

        <Route path="*" element={<ErrorPage code={404} />} />
      </Routes>
    </>
  );
}
