import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { post } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from './toast.jsx';
import { Chip, LEVELS, applyFieldErrors } from './ui.jsx';

/* ------------------------------------------------------------------ skills */

export function SkillPicker({
  catalogue, selected, onChange, levelKey = 'proficiency_level', showFocus = true, maxFocus = 5,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const chosen = new Set(selected.map((item) => item.skill_id));
  const matches = (catalogue || [])
    .filter((skill) => !chosen.has(skill.skill_id))
    .filter((skill) => !query || skill.skill_name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12);

  const update = (skillId, patch) => onChange(
    selected.map((item) => (item.skill_id === skillId ? { ...item, ...patch } : item)),
  );

  const add = (skill) => {
    onChange([...selected, {
      skill_id: skill.skill_id,
      skill_name: skill.skill_name,
      category: skill.category,
      [levelKey]: 'beginner',
      ...(showFocus ? { is_focus: false } : {}),
    }]);
    setQuery('');
    setOpen(true);
  };

  const focusCount = selected.filter((item) => item.is_focus).length;

  return (
    <div>
      {selected.length === 0 && (
        <p className="text-muted small mb-2">No skills added yet. Search the catalogue below.</p>
      )}

      {selected.map((item) => (
        <div key={item.skill_id} className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
          <div className="me-auto">
            <div className="fw-semibold small">{item.skill_name}</div>
            {item.category && <div className="text-muted" style={{ fontSize: '0.72rem' }}>{item.category}</div>}
          </div>
          <Form.Select
            size="sm"
            style={{ width: 145 }}
            value={item[levelKey] || 'beginner'}
            onChange={(event) => update(item.skill_id, { [levelKey]: event.target.value })}
            aria-label={`Level for ${item.skill_name}`}
          >
            {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Form.Select>
          {showFocus && (
            <Form.Check
              type="checkbox"
              id={`focus-${item.skill_id}`}
              label="Focus"
              checked={Boolean(item.is_focus)}
              disabled={!item.is_focus && focusCount >= maxFocus}
              onChange={(event) => update(item.skill_id, { is_focus: event.target.checked })}
              title={`Focus skills are prioritised by matching (${focusCount}/${maxFocus})`}
            />
          )}
          <Button
            size="sm"
            variant="outline-secondary"
            aria-label={`Remove ${item.skill_name}`}
            onClick={() => onChange(selected.filter((row) => row.skill_id !== item.skill_id))}
          >
            Remove
          </Button>
        </div>
      ))}

      <div className="mt-3">
        <Form.Label className="mb-1">Add a skill</Form.Label>
        <Form.Control
          size="sm"
          placeholder="Search skills…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        />
        {open && (
          <div className="mt-2 d-flex flex-wrap gap-1">
            {matches.length === 0 && (
              <span className="text-muted small">
                {query ? 'No matching skills.' : 'All catalogue skills have been added.'}
              </span>
            )}
            {matches.map((skill) => (
              <Chip key={skill.skill_id} onClick={() => add(skill)} title={skill.category || undefined}>
                + {skill.skill_name}
              </Chip>
            ))}
          </div>
        )}
        {showFocus && (
          <div className="form-text">
            {focusCount} of {maxFocus} focus skills chosen. Focus skills drive recommendation scoring.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ interests */

export function InterestPicker({ catalogue, selectedIds, onChange, max }) {
  const selected = new Set(selectedIds);
  const toggle = (id) => {
    if (selected.has(id)) onChange(selectedIds.filter((value) => value !== id));
    else if (!max || selectedIds.length < max) onChange([...selectedIds, id]);
  };
  return (
    <div>
      <div className="d-flex flex-wrap">
        {(catalogue || []).filter((interest) => interest.is_active !== false).map((interest) => (
          <Chip
            key={interest.interest_id}
            selected={selected.has(interest.interest_id)}
            onClick={() => toggle(interest.interest_id)}
            title={interest.description || undefined}
          >
            {interest.interest_name}
          </Chip>
        ))}
      </div>
      <div className="form-text">{selectedIds.length} selected{max ? ` · choose up to ${max}` : ''}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ password */

export function PasswordForm({ onSuccess, compact = false }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!form.current_password) errors.current_password = 'Enter your current password.';
    if (form.new_password.length < 10) errors.new_password = 'Use at least 10 characters.';
    if (form.new_password !== form.confirm) errors.confirm = 'Passwords do not match.';
    if (form.current_password && form.current_password === form.new_password) {
      errors.new_password = 'Choose a password different from the current one.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      await post('/users/me/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setForm({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password form demonstrated. No real password was changed or device signed out.');
      await refreshUser().catch(() => {});
      onSuccess?.();
    } catch (err) {
      setError(err);
      const mapped = {};
      (err.details || []).forEach((detail) => {
        const field = String(detail.field || '').split('.').pop();
        if (field === 'current_password' || field === 'new_password') mapped[field] = detail.issue;
      });
      if (err.code === 'INVALID_CREDENTIALS') mapped.current_password = 'The current password is not correct.';
      setFieldErrors((current) => ({ ...current, ...mapped }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Form onSubmit={submit} noValidate>
      {error && !Object.keys(fieldErrors).filter((key) => fieldErrors[key]).length && (
        <Alert variant="danger" className="py-2 small">{error.message}</Alert>
      )}
      <Form.Group className={compact ? 'mb-2' : 'mb-3'}>
        <Form.Label>Current password</Form.Label>
        <Form.Control
          type="password"
          value={form.current_password}
          onChange={set('current_password')}
          isInvalid={Boolean(fieldErrors.current_password)}
          autoComplete="current-password"
          required
        />
        <Form.Control.Feedback type="invalid">{fieldErrors.current_password}</Form.Control.Feedback>
      </Form.Group>
      <Form.Group className={compact ? 'mb-2' : 'mb-3'}>
        <Form.Label>New password</Form.Label>
        <Form.Control
          type="password"
          value={form.new_password}
          onChange={set('new_password')}
          isInvalid={Boolean(fieldErrors.new_password)}
          autoComplete="new-password"
          required
        />
        <Form.Control.Feedback type="invalid">{fieldErrors.new_password}</Form.Control.Feedback>
        <Form.Text className="text-muted">Demo preview only; use 10 or more sample characters. No password is saved.</Form.Text>
      </Form.Group>
      <Form.Group className={compact ? 'mb-2' : 'mb-3'}>
        <Form.Label>Confirm new password</Form.Label>
        <Form.Control
          type="password"
          value={form.confirm}
          onChange={set('confirm')}
          isInvalid={Boolean(fieldErrors.confirm)}
          autoComplete="new-password"
          required
        />
        <Form.Control.Feedback type="invalid">{fieldErrors.confirm}</Form.Control.Feedback>
      </Form.Group>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy && <Spinner animation="border" size="sm" className="me-2" />}
        Change password
      </Button>
    </Form>
  );
}

/* ------------------------------------------------------------------ misc */

export function MissingFieldsNote({ items }) {
  if (!items.length) return null;
  return (
    <div className="review-note">
      <div className="fw-semibold mb-1">Complete these before submitting:</div>
      <ul className="mb-0 ps-3">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export { applyFieldErrors };
