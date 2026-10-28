import { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demo/fixtures.js';
import { homeFor, useAuth } from '../auth.jsx';
import { useToast } from '../components/toast.jsx';
import { useTitle } from '../components/ui.jsx';

/* ------------------------------------------------------------------ layout */

const POINTS = [
  ['Find the right mentor', 'Search by skill, career pathway, experience and availability.'],
  ['Plan the relationship', 'Send a goal-based request; accepted requests become a mentorship.'],
  ['Meet and review', 'Book open slots, keep shared notes and rate completed sessions.'],
];

function AuthLayout({ children, title, subtitle }) {
  useTitle(title);
  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <Link to="/login" className="brand">
          <span className="brand-mark">IITM</span>
          <span>Mentoring Platform</span>
        </Link>
        <div className="my-4">
          <h1>Guidance from people who have walked the path.</h1>
          <p className="mt-3">
            Student mentoring and career support for the IITM online programme — connect with
            alumni and recent graduates, book sessions and keep every commitment in one place.
          </p>
          <div className="hero-points">
            {POINTS.map(([heading, text]) => (
              <div className="hero-point" key={heading}>
                <span className="dot" aria-hidden="true">✓</span>
                <span><strong className="text-white">{heading}.</strong> {text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="small" style={{ color: '#9fb6cf' }}>
          Milestone 2 · Offline demo · Fictional local data only
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2 className="h4 fw-bold mb-1">{title}</h2>
          {subtitle && <p className="text-muted small mb-4">{subtitle}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ login */

export function Login() {
  const { login, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    if (location.state?.toast) toast.info(location.state.toast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      const target = location.state?.from;
      navigate(target || homeFor(user.role), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const account = await login(email.trim(), password);
      toast.success(`Welcome back, ${account.full_name}.`);
      let target = location.state?.from;
      if (!target) {
        if (account.role === 'student' && !account.profile_completed) target = '/student/onboarding';
        else target = homeFor(account.role);
      }
      navigate(target, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demo) => {
    setEmail(demo.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <AuthLayout title="Sign in" subtitle="Use your programme account to continue.">
      {error && (
        <Alert variant="danger" className="py-2 small">
          <div className="fw-semibold">{error.code === 'INVALID_CREDENTIALS' ? 'Sign-in failed' : error.code}</div>
          <div>{error.message}</div>
          {error.code === 'ACCOUNT_SUSPENDED' && (
            <div className="mt-1">Contact the programme office if you believe this is a mistake.</div>
          )}
          {error.code === 'RATE_LIMITED' && (
            <div className="mt-1">Too many attempts. Wait a minute before trying again.</div>
          )}
        </Alert>
      )}

      <Form onSubmit={submit} noValidate>
        <Form.Group className="mb-3" controlId="login-email">
          <Form.Label>E-mail</Form.Label>
          <Form.Control
            type="email"
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            isInvalid={Boolean(error?.fieldError('email'))}
            required
          />
          <Form.Control.Feedback type="invalid">Enter a valid e-mail address.</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-2" controlId="login-password">
          <div className="d-flex justify-content-between align-items-center">
            <Form.Label>Password</Form.Label>
            <Link to="/forgot-password" className="small text-decoration-none">Forgot password?</Link>
          </div>
          <div className="position-relative">
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none"
              onClick={() => setShowPassword((current) => !current)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </Button>
          </div>
        </Form.Group>

        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={busy || !email || !password}>
          {busy && <Spinner animation="border" size="sm" className="me-2" />}
          Sign in
        </Button>
      </Form>

      <div className="text-center small text-muted my-3">New to the platform?</div>
      <Link to="/register" className="btn btn-outline-primary w-100">Create an account</Link>

      <div className="demo-box mt-4">
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold text-navy"
          onClick={() => setDemoOpen((open) => !open)}
          aria-expanded={demoOpen}
        >
          {demoOpen ? '▾' : '▸'} Demo accounts
        </button>
        {demoOpen && (
          <div className="mt-2">
            <div className="small text-muted mb-2">
              Seeded for this build. Click to fill the form.
            </div>
            <div className="d-flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <Button key={demo.email} size="sm" variant="outline-secondary" onClick={() => fillDemo(demo)}>
                  {demo.label}
                </Button>
              ))}
            </div>
            <div className="text-muted mt-2" style={{ fontSize: '0.7rem' }}>
              Demo password: {DEMO_PASSWORD} · No real authentication
            </div>
          </div>
        )}
      </div>

      <p className="auth-legal mt-4 mb-0">
        Local demonstration only. Use fictional details. No real authentication, emails or external
        notifications are provided; sample changes stay in this browser.
      </p>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ registration */

export function Register() {
  const { register, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [privacy, setPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (user) navigate(homeFor(user.role), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const errors = {};
    if (!form.full_name.trim() || form.full_name.trim().length > 120) errors.full_name = 'Enter your full name (1–120 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid e-mail address.';
    if (form.password.length < 10) errors.password = 'Use at least 10 characters.';
    if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';
    if (!privacy) errors.privacy = 'Accept the privacy notice to continue.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      const account = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
      });
      toast.success('Account created. Complete your profile to get started.');
      navigate(account.role === 'mentor' ? '/mentor/profile' : '/student/onboarding', { replace: true });
    } catch (err) {
      setError(err);
      const mapped = {};
      (err.details || []).forEach((detail) => {
        const field = String(detail.field || '').split('.').pop();
        if (['full_name', 'email', 'password', 'role'].includes(field)) mapped[field] = detail.issue;
      });
      if (err.code === 'DUPLICATE_ENTRY' || err.code === 'CONFLICT') mapped.email = err.message;
      setFieldErrors((current) => ({ ...current, ...mapped }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create an account" subtitle="Local demo only. Enter fictional details; no real account is created.">
      {error && !Object.keys(fieldErrors).length && (
        <Alert variant="danger" className="py-2 small">{error.message}</Alert>
      )}

      <Form onSubmit={submit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label>I am joining as</Form.Label>
          <div className="role-toggle">
            <button
              type="button"
              className={`role-option ${role === 'student' ? 'selected' : ''}`}
              onClick={() => setRole('student')}
            >
              <strong>Student</strong>
              <span>Find a mentor and request guidance</span>
            </button>
            <button
              type="button"
              className={`role-option ${role === 'mentor' ? 'selected' : ''}`}
              onClick={() => setRole('mentor')}
            >
              <strong>Mentor</strong>
              <span>Alumnus or recent graduate</span>
            </button>
          </div>
          {role === 'mentor' && (
            <div className="policy-note mt-2">
              Mentor profiles appear in search only after an administrator approves them.
            </div>
          )}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Full name</Form.Label>
          <Form.Control
            value={form.full_name}
            onChange={update('full_name')}
            maxLength={120}
            isInvalid={Boolean(fieldErrors.full_name)}
            autoComplete="name"
            required
          />
          <Form.Control.Feedback type="invalid">{fieldErrors.full_name}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>E-mail</Form.Label>
          <Form.Control
            type="email"
            value={form.email}
            onChange={update('email')}
            isInvalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            required
          />
          <Form.Control.Feedback type="invalid">{fieldErrors.email}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Password</Form.Label>
          <div className="position-relative">
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              isInvalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
              required
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none"
              onClick={() => setShowPassword((current) => !current)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </Button>
            <Form.Control.Feedback type="invalid">{fieldErrors.password}</Form.Control.Feedback>
          </div>
          <Form.Text className="text-muted">At least 10 characters. A passphrase works well.</Form.Text>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Confirm password</Form.Label>
          <Form.Control
            type={showPassword ? 'text' : 'password'}
            value={form.confirm}
            onChange={update('confirm')}
            isInvalid={Boolean(fieldErrors.confirm)}
            autoComplete="new-password"
            required
          />
          <Form.Control.Feedback type="invalid">{fieldErrors.confirm}</Form.Control.Feedback>
        </Form.Group>

        <Form.Check
          className="mb-3"
          id="privacy"
          checked={privacy}
          onChange={(event) => {
            setPrivacy(event.target.checked);
            setFieldErrors((current) => ({ ...current, privacy: undefined }));
          }}
          isInvalid={Boolean(fieldErrors.privacy)}
          label={(
            <span className="small text-muted">
              I agree that my profile details are shared with mentors I contact and with programme
              administrators, as described in the privacy notice.
            </span>
          )}
          feedback={fieldErrors.privacy}
          feedbackType="invalid"
        />

        <Button type="submit" variant="primary" className="w-100" disabled={busy}>
          {busy && <Spinner animation="border" size="sm" className="me-2" />}
          Create account
        </Button>
      </Form>

      <div className="text-center small text-muted mt-3">
        Already registered? <Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ forgot */

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      if (err.status === 202 || err.code === 'ACCEPTED') setSent(true);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Forgot your password?" subtitle="Presentation-only demo. No reset email will be sent.">
      {sent ? (
        <>
          <Alert variant="success" className="small">
            Demo request received locally. No email was sent.
          </Alert>
          <p className="small text-muted">
            You can <Link to="/reset-password?token=demo-preview">preview the existing reset form</Link>.
            No real password is stored or changed in this demonstration.
          </p>
          <Link to="/login" className="btn btn-outline-primary w-100 mt-2">Back to sign in</Link>
        </>
      ) : (
        <Form onSubmit={submit}>
          {error && <Alert variant="danger" className="py-2 small">{error.message}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100" disabled={busy || !email}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            Send reset link
          </Button>
          <div className="text-center small mt-3">
            <Link to="/login">Back to sign in</Link>
          </div>
        </Form>
      )}
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ reset */

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const expired = useMemo(() => !token, [token]);

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (form.password.length < 10) errors.password = 'Use at least 10 characters.';
    if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      await post('/auth/reset-password', { token, new_password: form.password });
      toast.success('Reset form demonstrated. No real password was changed.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Presentation-only demo. Use sample values; no real password will be changed.">
      {expired ? (
        <>
          <Alert variant="warning" className="small">
            This link is missing its token. It may have expired or already been used.
          </Alert>
          <Link to="/forgot-password" className="btn btn-primary w-100">Request a new link</Link>
          <div className="text-center small mt-3"><Link to="/login">Back to sign in</Link></div>
        </>
      ) : (
        <Form onSubmit={submit}>
          {error && (
            <Alert variant="danger" className="py-2 small">
              <div className="fw-semibold">{error.code === 'INVALID_TOKEN' ? 'Link expired or already used' : error.code}</div>
              <div>{error.message}</div>
              {error.code === 'INVALID_TOKEN' && (
                <Link to="/forgot-password" className="alert-link">Request a new link</Link>
              )}
            </Alert>
          )}
          <Form.Group className="mb-3">
            <Form.Label>New password</Form.Label>
            <Form.Control
              type="password"
              autoFocus
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              isInvalid={Boolean(fieldErrors.password)}
              autoComplete="new-password"
              required
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.password}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Confirm new password</Form.Label>
            <Form.Control
              type="password"
              value={form.confirm}
              onChange={(event) => setForm((current) => ({ ...current, confirm: event.target.value }))}
              isInvalid={Boolean(fieldErrors.confirm)}
              autoComplete="new-password"
              required
            />
            <Form.Control.Feedback type="invalid">{fieldErrors.confirm}</Form.Control.Feedback>
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100" disabled={busy}>
            {busy && <Spinner animation="border" size="sm" className="me-2" />}
            Set password
          </Button>
          <div className="text-center small mt-3"><Link to="/login">Back to sign in</Link></div>
        </Form>
      )}
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ errors */

const ERROR_COPY = {
  401: ['Session expired', 'Your session has expired or is no longer valid. Sign in again to continue.'],
  403: ['Access denied', 'Your account does not have permission to open this page.'],
  404: ['Page not found', 'The page may have moved, or the item is not visible to your account.'],
  500: ['Something went wrong', 'The request could not be completed. Try again, and quote the reference below if it keeps happening.'],
};

export function ErrorPage({ code = 404, requestId, sessionExpired = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const numeric = Number(code) || (sessionExpired ? 401 : 404);
  const [heading, text] = ERROR_COPY[numeric] || ERROR_COPY[404];

  useTitle(heading);

  const goHome = () => navigate(user ? homeFor(user.role) : '/login');

  return (
    <AuthLayout title={`${numeric} · ${heading}`} subtitle={text}>
      <div className="empty-state py-4">
        <div className="empty-icon" aria-hidden="true">{numeric === 403 ? '🔒' : numeric === 401 ? '⌛' : numeric === 500 ? '⚠' : '🔎'}</div>
        <h5>{sessionExpired ? 'Your session has ended' : heading}</h5>
        <p className="mb-3">
          {numeric === 401
            ? 'This demonstrates the session-expired screen. Choose a demo account to continue; no real access token is used.'
            : 'You can return to your dashboard or go back to the previous page.'}
        </p>
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          {numeric === 401 ? (
            <Button variant="primary" onClick={async () => { await logout(); toast.info('Please sign in again.'); }}>
              Sign in again
            </Button>
          ) : (
            <Button variant="primary" onClick={goHome}>Go to my dashboard</Button>
          )}
          <Button variant="outline-secondary" onClick={() => navigate(-1)}>Go back</Button>
        </div>
        {requestId && (
          <p className="small text-muted mt-3 mb-0">
            Reference: <code>{requestId}</code>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
