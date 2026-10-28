import { createFixtures } from './fixtures.js';
import { fail } from './errors.js';

export const DATA_KEY = 'iitm-mentoring-m2-data-v1';
export const SESSION_KEY = 'iitm-mentoring-m2-session-v1';

/** Memory fallback lets the demo run when browser storage is disabled. */
export function createDemoStore(storage, clock = () => new Date()) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const read = (key) => { try { return storage?.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { storage?.setItem(key, value); } catch { /* memory-only demo */ } };
  let data;
  try {
    const saved = JSON.parse(read(DATA_KEY) || 'null');
    const tables = ['users', 'skills', 'interests', 'students', 'mentors', 'requests', 'mentorships', 'slots', 'sessions', 'feedback', 'notifications', 'audit'];
    if (!saved || !tables.every((key) => Array.isArray(saved[key]))) throw new Error('Invalid demo data');
    data = saved;
  } catch { data = createFixtures(clock()); }
  let sessionId = read(SESSION_KEY) || null;
  const persist = () => write(DATA_KEY, JSON.stringify(data));
  persist();
  return {
    get data() { return data; },
    now: () => clock().toISOString(),
    id: (kind) => `${kind}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    user() { return data.users.find((user) => user.user_id === sessionId) || null; },
    signIn(id) { sessionId = id; write(SESSION_KEY, id); },
    signOut() { sessionId = null; write(SESSION_KEY, ''); },
    save: persist,
    reset() { data = createFixtures(clock()); this.signOut(); persist(); },
    // A failed simulated action must not partially change the local records.
    transaction(action) {
      const before = structuredClone(data);
      try { const result = action(); persist(); return structuredClone(result ?? {}); }
      catch (error) { data = before; throw error; }
    },
    requireUser(roles) {
      const user = this.user();
      if (!user) fail('UNAUTHENTICATED', 'Choose a local demo account to continue.', 401);
      if (user.account_status !== 'active') fail('ACCOUNT_SUSPENDED', 'This sample account is inactive.', 403);
      if (roles && !roles.includes(user.role)) fail('FORBIDDEN', 'This demo role cannot perform that action.', 403);
      return user;
    },
  };
}
