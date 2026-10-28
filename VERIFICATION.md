# Verification record

Date: 28 October 2026. This records executed checks, not assumed browser results.

## Executed successfully

| Check | Actual result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Installed the 132 locked packages successfully. No new library was added. |
| `npm run build` | Passed on the final source: Vite 6.4.5, 277 transformed modules, JavaScript 497.32 kB before gzip (145.44 kB gzip). CSS 247.43 kB before gzip. |
| `npm run dev -- --host 127.0.0.1` | Vite started successfully on port 5173 without a backend. |
| `npm run test:demo` | All 18 Node tests passed; zero failures. |
| Original team-file comparison | SHA-256 comparison of 107 original source/document files across frontend, backend, database and design source found no changes. Dependency folders, build output and caches were excluded. |
| Presentation preservation | `App.jsx`, `main.jsx`, `styles.css`, shared `ui.jsx` and `dialogs.jsx`, favicon and lockfile compared byte-identical with the original frontend. |

The tests actually exercised:

- Student, mentor and admin sign-in at the service boundary, session restoration and sign-out,
  without storing passwords or issuing tokens.
- Local role permissions, record ownership, suspension/reactivation and failed-state errors.
- Profile edits and persistence across newly constructed service/store instances.
- Discovery search/filter/sort/pagination and illustrative recommendations.
- Request creation/cancellation, duplicate rejection, mentor acceptance/decline and the resulting
  student mentorship/notification records.
- Single and recurring availability, edits/deletion, overlap rejection and rollback of a failed
  multi-slot action.
- Session booking, conflict rejection, notes, cancellation, slot release and completion after start.
- One-time feedback, refreshed rating summaries and mentorship closure.
- Notification read/unread counts, admin approvals, catalogue edits, audit records, analytics and CSV.
- Local registration/onboarding and presentation-only password forms.
- Storage-disabled and malformed-storage fallbacks.
- The original route declarations for every one of the 26 documented logical page groups.
- Service responses for the page data dependencies, including required nested profile/summary fields.
- Static absence of fetch/XHR/Axios/WebSocket/EventSource transports in active application source,
  and absence of the Vite proxy. The inactive integration reference is outside the active source.

## Browser checks not yet executed

The browser tool reported no connected browser during implementation. Therefore the following
are **unverified**, despite passing service/static/build checks:

- Clicking login and navigating all 26 groups in a real browser.
- Screenshot/visual comparison, narrow-screen layout, keyboard behavior and dialog interactions.
- Deep-link reload and browser history behavior.
- A browser Network-panel trace proving no backend/remote data requests during user interactions.
- The actual browser CSV download operation (CSV content generation passed service tests).

Static source and build verification support the no-backend design, but are not a substitute for
an executed browser network trace. The app retains the original React routing/guard structure;
route declaration coverage is not presented as proof of all rendered UI behaviors.

## Manual browser checklist

1. Follow README setup at the final delivery location, then open the URL printed by Vite.
2. Open Network and Console; preserve the network log. Local Vite modules/assets and HMR are expected.
3. Use each demo role and visit the README's 26-group route list, including supplementary tabs,
   onboarding, recovery/reset/error pages and detail routes.
4. Check anonymous redirection, another role's `/403` protection and reload of a signed-in deep link.
5. Follow the README request-to-acceptance demo, then profile, availability, booking, cancellation,
   completion and feedback actions. Check the saved results after switching roles/reloading.
6. Check catalogue/review/admin actions and the CSV download. Meeting/LinkedIn links and password
   forms must remain visibly labelled as presentation-only.
7. Confirm no requests target `/api/v1`, port 8000 or external data services, and record any console
   or rendering errors with the route/action that caused them.

No backend integration, production authentication, database, email delivery, deployment, commit
or push was performed. These checks apply to the local Milestone 2 demonstration only.
