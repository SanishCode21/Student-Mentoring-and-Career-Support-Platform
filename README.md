# Student Mentoring and Career Support Platform - Milestone 2 frontend

This is a standalone demonstration of the existing React frontend. It runs without FastAPI,
PostgreSQL, Docker, remote data services, credentials or backend configuration. All sample people
and organisations are fictional. Layouts, CSS, routes and the original 26 logical page groups
are preserved. Small wording changes identify demonstration and presentation-only actions.

## Start the frontend

Install Node.js 20 or later and npm. Open a terminal in this folder:

```powershell
cd C:\Users\AsusS\Downloads\milestone2-frontend
npm ci
npm run dev
```

Open the local URL Vite prints, normally **http://localhost:5173**. No other terminal/server is
needed. `npm ci` downloads the locked npm dependencies, so installation may need internet access;
after installation the app uses only local files and local demo records. The development server
serves JavaScript/CSS and its usual local hot-reload connection; these are not backend API calls.

```powershell
npm run build      # creates dist/
npm run preview    # serves the built app locally
npm run test:demo  # Node's built-in test runner; no extra testing framework
```

If another program occupies port 5173, Vite prints the port it selects. Use that exact URL.
Browser storage is specific to the host/port: `localhost` and `127.0.0.1` have separate demo data.

## Demo access

On the existing login screen, expand **Demo accounts**, select a role, then click **Sign in**.

| Role | Fictional email | Sample password |
| --- | --- | --- |
| Student | `student@demo.test` | `demo-only-123` |
| Mentor | `mentor@demo.test` | `demo-only-123` |
| Administrator | `admin@demo.test` | `demo-only-123` |

This is role selection through the original login form, not real authentication. The sample
account must exist and the password input must have at least ten characters, but passwords are
not verified, hashed, saved or used as credentials. No JWT, refresh cookie or production token
is created. Use fictional inputs only. The local registration form creates another sample
student/mentor record and supports the original onboarding/profile flow.

Additional fictional accounts use the same demo input: `learner@demo.test`, `new-learner@demo.test`,
`research@demo.test`, `applicant@demo.test`, `paused@demo.test` and `careers@demo.test`.

The current role's user ID and sample records are saved in localStorage. Reloading restores that
demo account. Sign out before switching roles. Changes made by one role are visible when you
sign in as another role at the same host/port. This is not real multi-user synchronization;
reload another already-open tab to refresh its in-memory copy. If storage is blocked, records
still work in memory but do not survive reloads. Clearing browser storage restores fixtures.

## Suggested demonstration

1. Sign in as Student. Browse the dashboard, recommendations, directory and profiles. **Career
   Mentor** starts without a request from this student, so a new request can be submitted there.
2. Sign out and sign in as `careers@demo.test`. Open Incoming requests, inspect the student summary
   and accept/decline. Sign back in as Student to see the changed request/mentorship.
3. The default Student and default Mentor already share **mentorship-demo**, which makes session,
   notes, feedback and relationship screens available immediately. Student can book a future open
   slot; Mentor can see/cancel it. Future sessions cannot be completed early.
4. As the default Mentor, the seeded **session-ready** is scheduled but already started, so it can
   be marked completed. The seeded **session-rateable** is already completed and can be rated.
5. Edit the Student profile, Mentor expertise/capacity/pause setting and availability. Revisit the
   related lists to see the saved changes. Slot/session overlaps and duplicate feedback show errors.
6. Sign in as Administrator. Inspect the Applicant Mentor, complete the existing checklist and
   approve/reject. Try user status changes, catalogue edits, analytics filters and local CSV export.
7. Use the public recovery/error links or the routes below to show the remaining page groups.

## All 26 original page groups

The original design counts groups rather than individual URL paths. Some groups include multiple
routes or tabs. Dynamic routes below use the stable fixture IDs included with a fresh demo.

| Group | Page | Example route |
| --- | --- | --- |
| 1 | Sign in | `/login` |
| 2 | Registration | `/register` |
| 3 | Password recovery | `/forgot-password` |
| 4 | Reset and error pages | `/reset-password?token=demo-preview`, `/session-expired`, `/403`, `/404`, `/500` |
| 5 | Student onboarding | `/student/onboarding` |
| 6 | Student dashboard | `/student/dashboard` |
| 7 | Mentor discovery | `/student/mentors`, `/student/mentors?tab=all` |
| 8 | Mentor profile | `/student/mentors/mentor-demo` |
| 9 | Send mentoring request | `/student/mentors/mentor-three/request` |
| 10 | My requests | `/student/requests` |
| 11 | Mentorship overview | `/student/mentorships`, `/student/mentorships/mentorship-demo` |
| 12 | Sessions and feedback | `/student/mentorships/mentorship-demo/sessions` |
| 13 | Student profile | `/student/profile` |
| 14 | Student notifications | `/student/notifications` |
| 15 | Mentor dashboard | `/mentor/dashboard` |
| 16 | Incoming requests | `/mentor/requests` |
| 17 | Request detail | `/mentor/requests/request-pending` |
| 18 | My mentees | `/mentor/mentees` |
| 19 | Schedule and availability | `/mentor/schedule` |
| 20 | Mentor profile | `/mentor/profile` |
| 21 | Mentor notifications | `/mentor/notifications` |
| 22 | Admin dashboard | `/admin/dashboard` |
| 23 | Users and catalogues | `/admin/users`, `/admin/users?tab=catalogue` |
| 24 | Mentor review | `/admin/mentors` |
| 25 | Mentorship/request oversight | `/admin/mentorships`, `/admin/mentorships?tab=requests` |
| 26 | Programme analytics | `/admin/analytics` |

The original role guards remain: anonymous access to protected pages redirects to login, and
another role's pages redirect to `/403`. The service also checks role and record ownership, but
these checks are illustrative JavaScript, not a security boundary. Anyone with this local
frontend can inspect/edit its data.

## Fully simulated and presentation-only behavior

| Behavior | Scope |
| --- | --- |
| Demo sign-in, sign-out and restoration | Saved local role; no real authentication. |
| Registration, onboarding and profile edits | Local records and derived profile-completeness state. |
| Discovery and recommendations | Local search, filters, sorting, paging and illustrative matching reasons/scores. Not the production matching engine. |
| Requests | Submit/cancel, mentor accept/decline, mentorship creation, pending/capacity/duplicate checks and a demo 14-day decline cooldown. |
| Availability | Add/edit/delete individual slots and a local weekly recurrence helper; reject overlaps and changes to booked slots. Recurrence uses this browser's local time zone. |
| Sessions | Slot booking, mentor custom-time booking, shared notes, cancellation, completion after start and conflict checks. |
| Feedback | One required written review per participant per completed session within the demo 14-day window. Admin analytics can display recent student review text and review counts. |
| Notifications | Local records, read/unread state and badge counts only. No delivery, email, push or real-time transport. |
| Administration | Local approval/rejection/suspension, user status changes, catalogue edits and sample audit records. No actual alumni verification. |
| Analytics and export | Counts/charts derived from local records, date filtering and CSV created in the browser. |
| Forgot/reset/change password and email verification | Presentation only. No email, password storage/update, other-device sign-out or real verification. Labelled in the UI. |
| Meeting/LinkedIn links | Presentation only. External navigation is disabled and labelled. No calls, calendars or external profile lookup. |
| Session-expired / 500 pages | Existing error-screen demonstrations; no real server failure or token expiry is required. |

There are no background jobs, automatic request-expiry notifications, concurrency guarantees,
server audit integrity or real delivery-time guarantees. Date comparisons are illustrative;
new fixtures use dates relative to first creation. These are not Milestone 3 integration tests.

## How the separation works

- `src/api.js` keeps the existing `get`, `post`, `patch`, `del`, `getAll`, `downloadCsv` and
  `ApiError` interfaces. Instead of making HTTP requests it calls JavaScript functions directly.
- `src/demo/fixtures.js` defines fictional people and connected sample records.
- `src/demo/store.js` loads/saves the local demo and rolls back failed multi-record actions.
- `src/demo/service.js` handles resource keys and simulated actions, validation and demo permissions.
- `src/demo/views.js` builds the response objects each original screen expects, including names,
  pagination metadata, notification counts and profile summaries.
- `src/demo/analytics.js` calculates illustrative reports from the same local records.
- `src/demo/errors.js` retains the form-friendly error interface.
- `src/auth.jsx` retains its context and role guards; its existing service calls now use the local
  implementation. Token setters in the standalone API module are compatibility no-ops.
- `vite.config.js` has no API or health proxy. `VITE_API_BASE` is not read by the standalone entry.

Only this copied frontend is changed. No team backend, database, generated API specification or
original frontend needs to be modified.

## Restore real integration later

`integration/api.fastapi.js` is an **inactive reference copy** of the original HTTP client. Nothing
under `src/` imports it, and it cannot activate through an environment variable. Axios remains in
the existing lockfile to preserve the original dependency setup, but is not imported by the
standalone runtime.

For a later integrated branch, replace `src/api.js` with that original client, restore the team
frontend's authentication/delivery copy as appropriate, and configure the backend proxy/API base
deliberately. The pages already use the same helper signatures and data/error envelopes, so they
do not need a UI rewrite. Re-run real API and browser tests at that point; local demo tests are not
evidence that FastAPI integration works.

## Reset the demonstration

With this local app open, use browser developer tools to remove only these two keys, then reload:

```javascript
localStorage.removeItem('iitm-mentoring-m2-data-v1');
localStorage.removeItem('iitm-mentoring-m2-session-v1');
location.assign('/login');
```

No reset button or new product screen was added.

## Verification

Run `npm run test:demo` for service workflow, persistence, role/ownership, response shape and
static route/transport checks. Run `npm run build` for production compilation. See `VERIFICATION.md`
for the checks actually executed and their limitations.

For browser verification, open Developer Tools > Network, preserve the log, sign in as each
role, visit every route above, reload deep links and try the demonstration actions. Check for
console errors, confirm incorrect-role access goes to `/403`, and verify no `/api/v1`, port 8000,
or remote data-service requests occur. Local Vite modules, favicon, styles and HMR are expected.

For submission, include source, public assets, the package/lockfile, Vite config and README.
Exclude `node_modules`, `dist`, browser storage, secrets and temporary verification output.
Do not include backend code. No deployment, commit or push is part of this preparation.
