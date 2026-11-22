# MeFit SRS compliance audit

Source of truth: SITER Academy, *MeFit Case-SITER*, sections 3.2–3.8. Assessed against public build `6e94d88` and the current source. “Partially” includes implementation that lacks end-to-end proof. The historical traceability matrix describes an earlier architecture and is not production evidence.

| ID | Requirement | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| FE-01 | Login gate, registration, three roles and admin-only grants | Partially | Live /login, App.tsx, RequireAuth.tsx | Public landing and no active three-role workflow | Enforce the SRS gate and connect role assignment to the production API |
| FE-02 | User identity, logout, navigation and role-gated contributor link | Partially | FitnessDesign.tsx, current dashboard | Contributor link absent, role UI unverified | Restore role-aware navigation using the API |
| FE-03 | Current week, goal progress, days left and details | Partially | FitnessOverview.tsx, FitnessWorkspace.tsx | The active planner tracks scheduled workouts rather than the full goal lifecycle | Connect goal details and dates |
| FE-04 | Goal management, history, completion and fitness-guided recommendations | Partially | FitnessWorkspace.tsx; GoalsPage.tsx is no longer the active route | Programs, multi-exercise composition, recommendations and suitability warning missing from active flow | Bring the goal workflow onto the active API and reconcile saved weeks |
| FE-05 | Program browse, category and workout details | Not met | App.tsx, historical CatalogPage.tsx | No active program browser | Connect program listing and details |
| FE-06 | Workout browse, type and exercise details | Partially | FitnessWorkspace.tsx | Planner entries are not the full searchable workout catalog | Connect workout catalog and prescriptions |
| FE-07 | Exercise listing, detail and muscle grouping | Partially | Live /catalog shell, ExerciseLibraryPage.tsx, exercise filter tests | Authenticated hosted browse and muscle grouping unverified | Group by target muscle and test using a dedicated account |
| FE-08 | Contributor program authoring | Not met | /contribute redirects to settings | Existing contributor component is disconnected | Restore and verify contributor program routes |
| FE-09 | Contributor workout authoring and editable sets | Not met | /contribute redirects to settings | Existing contributor component is disconnected | Restore and verify workout ownership workflow |
| FE-10 | Contributor exercise authoring | Not met | /contribute redirects to settings, API route requires ADMIN | Contributors cannot author exercises | Define contributor ownership and enforce it in the active API |
| FE-11 | Mandatory profile, fitness evaluation, account changes, requests and MFA | Partially | ProfilePage.tsx, auth/supabase.ts | Active profile path lacks fitness limits and contributor requests | Restore evaluation and account management with server validation |
| API-01 | No query parameters except search | Not met | Browser uses PostgREST query parameters | Separate REST layer is bypassed | Move filters into route paths or request bodies |
| API-02 | JSON login, 401 and rate limiting | Partially | routes/login.ts | Active browser login delegates to Supabase; production API contract unverified | Align endpoint behavior and document limits |
| API-03 | User CRUD, 303 self redirect, role and password rules | Partially | routes/users.ts | Self endpoint returns JSON and existing deletion differs from the SRS | Add compatible contract and role/ownership tests before cutover |
| API-04 | Profile CRUD with owner-only deletion | Partially | routes/profiles.ts, active ProfilePage.tsx | Browser bypasses API and profile-ID contract is incomplete | Introduce API adapter over current profile records |
| API-05 | Goal CRUD and workout progress | Partially | routes/goals.ts | Legacy goal endpoints bypassed by the live planner | Connect goals without replacing persisted plans |
| API-06 | Workout CRUD and contributor ownership | Partially | routes/catalog.ts, routes/contributor.ts | Legacy implementation has no hosted role verification | Exercise auth and ownership across active endpoints |
| API-07 | Ordered exercises and contributor writes | Partially | routes/catalog.ts, routes/contributor.ts | Admin-only writes and parallel catalog schemas | Resolve ownership and reconcile catalog IDs |
| API-08 | Default statuses, Location, logging and sanitized errors | Partially | app.ts and routes | Contract incomplete across endpoints | Add endpoint-level response tests and correct missing metadata |
| DB-01 | Persistent controlled database | Partially | Supabase migrations 001–012, themePreferenceState.ts | Browser PostgREST bypasses the assigned API architecture; device preferences remain local | Use scoped server data access with RLS |
| DB-02 | Daily full backup with seven-day retention | Not met | BACKUP_RESTORE.md | No verified scheduled production backup or retention | Verify plan, configure encrypted backup and rehearse restore |
| DB-03 | Documented database schema and ERD | Partially | DATABASE_SCHEMA.md, Prisma and Supabase migrations | Legacy documentation does not reconcile current production tables | Document both schemas and generate current ERD |
| SEC-01 | Bearer authentication, MFA, rate limits | Partially | auth/authorization.ts, auth/supabase.ts | No proof MFA is enforced at all data boundaries; live API and browser use different paths | Enforce AAL2 at the active server boundary and verify policy behavior |
| SEC-02 | Safe input and output | Partially | Zod in legacy routes, React rendering | Coverage incomplete for the active data API | Validate all data at the REST boundary |
| SEC-03 | Credentials supplied via environment variables | Partially | .env.example and Vercel configuration | Full secret exposure audit unverified | Scan repo history and shipped assets without printing credentials |
| SEC-04 | HTTPS in production; requested security headers | Partially | Live HTTPS and HSTS, vercel.json candidate | Header rollout pending public verification | Verify HTTPS and headers on the released candidate |
| PRF-01 | Responsive, bounded loading | Partially | Prior landing Lighthouse and UI loading states | Recent authenticated API timing and per-route audits pending | Measure the sign-in and data flows against the active API |
| PRF-02 | Useful, non-sensitive errors | Partially | ProfilePage.tsx, FitnessWorkspace.tsx, authorization.ts | Hosted failure cases not verified | Exercise expired session, provider and server failure paths |
| DOC-01 | Separate role manual, screenshots and requested PDF | Partially | USER_MANUAL.md, docs/assets | Older screenshots, incomplete role evidence and no PDF | Capture current deployed role screens and export manual |
| DOC-02 | Full endpoint documentation and requested OpenAPI | Partially | API_DOCUMENTATION.md | Documentation describes legacy paths and lacks a verified current OpenAPI contract | Generate and test the active endpoint specification |
| DOC-03 | README, team and complete setup | Partially | README.md, INSTALLATION.md | Instructions mix legacy and live architecture; clean setup not reverified | Document the chosen API and repeat a clean setup |
| MISC-01 | Repository, documentation and deployment deliverables | Partially | GitHub, Vercel, docs/ | Several required deliverables and live role checks incomplete | Complete listed prerequisites |
| MISC-02 | 30-minute presentation and defense | Partially | PRESENTATION.md, PRESENTATION_OUTLINE.md | Role demos still depend on restored functionality | Rehearse against the completed release |

The brief’s admin area is tracked under FE-01/02/11 and API-03. Program and request endpoints are tracked under FE-05/08/11 and API-08; they are not additional numbered PDF requirements.

## Audit run

- Production returned HTTP 200 for the landing, login and catalog shells. These responses establish route availability, not authenticated functionality.
- The first two public API probes timed out at 16 seconds. A later warm pass returned 401 for unauthenticated user, profile and goal requests, and 404 for /api/health. The exercise list returned 200 after 11.9 seconds.
- Candidate lint, TypeScript builds and 36 frontend tests passed. Lint retains existing warnings.
- The draft header policy constrains base URLs, embedded objects and framing. It deliberately does not claim a fully tested script-origin allowlist.
- The API transition, backup policy and three-role hosted checks remain release blockers. This audit does not authorize a production data migration.
