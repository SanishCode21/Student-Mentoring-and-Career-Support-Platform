# Changes from the copied team frontend

## Initial dependency inventory and smallest-change plan

Before editing, `App.jsx`, `api.js`, `auth.jsx`, page modules and shared components were inspected.
All runtime HTTP traffic was centralized in `api.js`, including the separate Axios refresh call.
Consumers were:

- `auth.jsx`: login, registration, refresh/session restoration, logout and current user.
- `App.jsx`: choose the current mentorship.
- `components/shell.jsx`: notification badge/polling.
- `components/editors.jsx`: password change.
- `components/dialogs.jsx`: booking, feedback, availability, request details, catalogue edits,
  session notes/meeting details.
- `pages/public.jsx`: password recovery and reset.
- `pages/student.jsx`: onboarding/profile, catalogues, dashboard, discovery, requests,
  mentorship/session history, feedback and notifications.
- `pages/mentor.jsx`: dashboard/profile, capacity/pause, incoming requests, mentees,
  availability, sessions and notifications.
- `pages/admin.jsx`: users/status, mentor review, catalogue maintenance, oversight, audit,
  analytics and CSV.
- `vite.config.js`: `/api` and `/health` forwarding to port 8000.

The plan was to retain the helper interface and existing pages, replace only its transport with
local services, retain role guards and change wording only where real delivery/authentication
would otherwise be implied. That is the implemented approach.

## File summary

| File | Change and reason |
| --- | --- |
| `src/api.js` | Replaced active Axios/refresh/network code with calls to the independent local service. Preserved helpers and local CSV download. |
| `src/demo/fixtures.js` | Added fictional users, profiles, catalogues, requests, mentorships, slots, sessions, feedback and notifications with usable relative dates. |
| `src/demo/store.js` | Added localStorage persistence, memory fallback and rollback of failed local mutations. |
| `src/demo/service.js` | Added simulated existing actions, ownership/role checks, errors and connected local state changes. |
| `src/demo/views.js` | Preserved the data objects and pagination shapes expected by the pages. |
| `src/demo/analytics.js` | Derived reports/charts from the local records. |
| `src/demo/errors.js` | Retained the existing error/field-error interface independently of HTTP. |
| `src/auth.jsx` | Changed restoration wording/comments to demo terminology. Existing context, service calls, login flow and guards remain. |
| `src/pages/public.jsx` | Replaced the old demo-account details with fictional `.test` accounts and clearly labelled local/password-recovery previews. |
| `src/components/shell.jsx` | Identified local-demo mode using existing brand/footer text. |
| `src/components/toast.jsx` | Prefixed existing action feedback with `Local demo`. |
| `src/components/editors.jsx` | Labelled password changes as presentation-only; no real credentials or device revocation are claimed. |
| `src/pages/student.jsx`, `mentor.jsx`, `admin.jsx` | Changed notification/password wording and disabled/labelled external meeting/profile links. No screen layouts or workflows were redesigned. |
| `vite.config.js` | Removed backend/health proxies. |
| `package.json` | Added `test:demo` using Node's built-in runner. No dependencies added. |
| `integration/api.fastapi.js` | Saved an inactive reference copy of the original adapter for future integration. |
| `tests/demo.test.js`, `tests/pages.test.js` | Added reproducible checks for meaningful simulated workflows, persistence, permissions, shapes, declared routes and absence of active data transports. |
| `README.md` | Added independent setup, role access, all 26 page groups, demonstration instructions, limitations and integration-restoration notes. |
| `VERIFICATION.md` | Records executed verification and distinguishes browser checks from static/service checks. |

`src/App.jsx`, `src/main.jsx`, `src/styles.css`, `src/components/ui.jsx`,
`src/components/dialogs.jsx`, public assets and `package-lock.json` remain byte-identical to the
source copy. No new runtime/test dependency, framework, product page or CSS was added.
