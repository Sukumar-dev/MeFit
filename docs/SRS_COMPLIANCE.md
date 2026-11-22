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
| DB-02 | Daily full backup with seven-day retention | Not met | Supabase Free plan confirmed; encrypted daily workflow and local restore drill | No successful hosted backup run or verified retention | Configure GitHub Actions secrets and verify a retained archive with a restore drill |
| DB-03 | Documented database schema and ERD | Partially | [Production ERD](assets/production-erd.svg) checked against live column and foreign-key metadata | Diagram covers the eight browser-facing tables and their auth parent; legacy schema documentation remains separate | Reconcile the legacy schema and record parity with the REST release |
| SEC-01 | Bearer authentication, MFA, rate limits | Partially | auth/authorization.ts, auth/supabase.ts | No proof MFA is enforced at all data boundaries; live API and browser use different paths | Enforce AAL2 at the active server boundary and verify policy behavior |
| SEC-02 | Safe input and output | Partially | Zod in legacy routes, React rendering | Coverage incomplete for the active data API | Validate all data at the REST boundary |
| SEC-03 | Credentials supplied via environment variables | Partially | .env.example and Vercel configuration | Full secret exposure audit unverified | Scan repo history and shipped assets without printing credentials |
| SEC-04 | HTTPS in production; requested security headers | Partially | Live HTTPS and HSTS, vercel.json candidate | Header rollout pending public verification | Verify HTTPS and headers on the released candidate |
| PRF-01 | Responsive, bounded loading | Partially | Prior landing Lighthouse and UI loading states | Recent authenticated API timing and per-route audits pending | Measure the sign-in and data flows against the active API |
| PRF-02 | Useful, non-sensitive errors | Partially | ProfilePage.tsx, FitnessWorkspace.tsx, authorization.ts | Hosted failure cases not verified | Exercise expired session, provider and server failure paths |
| DOC-01 | Separate role manual, screenshots and requested PDF | Partially | [User manual](USER_MANUAL.md), [PDF](USER_MANUAL.pdf), public sign-in and registration screenshots | Signed-in screenshots and hosted walkthroughs are missing for all three roles | Capture the authenticated screens after the staging role flows pass |
| DOC-02 | Full endpoint documentation and requested OpenAPI | Partially | [API guide](API.md), [OpenAPI](openapi.yaml), generated route inventory | Field-level contracts and authenticated response verification are incomplete | Complete schemas and validate against the active hosted API |
| DOC-03 | README, team and complete setup | Partially | README.md, INSTALLATION.md | Instructions mix legacy and live architecture; clean setup not reverified | Document the chosen API and repeat a clean setup |
| MISC-01 | Repository, documentation and deployment deliverables | Partially | GitHub, Vercel, docs/ | Several required deliverables and live role checks incomplete | Complete listed prerequisites |
| MISC-02 | 30-minute presentation and defense | Partially | [Timed slide deck](MEFIT_PRESENTATION.pptx) | Hosted role demonstrations and full rehearsal are pending | Rehearse against the verified release |

The brief’s admin area is tracked under FE-01/02/11 and API-03. Program and request endpoints are tracked under FE-05/08/11 and API-08; they are not additional numbered PDF requirements.

## Audit run

- Production returned HTTP 200 for the landing, login and catalog shells. These responses establish route availability, not authenticated functionality.
- The first two public API probes timed out at 16 seconds. A later warm pass returned 401 for unauthenticated user, profile and goal requests, and 404 for /api/health. The exercise list returned 200 after 11.9 seconds.
- Candidate lint, TypeScript builds and 36 frontend tests passed. Lint retains existing warnings.
- The draft header policy constrains base URLs, embedded objects and framing. It deliberately does not claim a fully tested script-origin allowlist.
- The API transition, backup policy and three-role hosted checks remain release blockers. This audit does not authorize a production data migration.

## REST profile candidate

The candidate route `/fitness-api/profile` provides self-scoped GET and PUT through a Vercel function. It validates Supabase asymmetric JWTs and AAL2 before forwarding the same bearer token to the RLS-protected data API. Run `node --test tests/fitness-profile.test.mjs` for the pre-release request-handler tests. This is the first API slice. The browser cutover and authenticated production verification are pending, so no SRS status changed.

## Batch 1 REST candidate

The route manifest in `server/fitness-contract.mjs` covers 42 method/path combinations, including aliases and health. `api/fitness-batch.mjs` gates registered paths with Supabase JWT and AAL2 checks, then dispatches to the existing Express routes with their Zod validation and database ownership checks.

| ID | Candidate evidence | Remaining gap |
|---|---|---|
| API-01 | Anonymous manifest tests and query rejection check in `tests/fitness-batch.test.mjs` | Authenticated search checks |
| API-02 | Supabase owns sign-in; legacy Keycloak login is excluded from this namespace | Hosted provider rate-limit evidence |
| API-03 | Existing user routes mounted, including the 303 self redirect | Registration requires a Supabase identity; admin-field contract, password change, and cascading deletion are incomplete |
| API-04 | Profile routes mounted; independent profile handler tests cover ownership and MFA | API schema uses the compatibility Profile table; no migration of existing browser profiles performed |
| API-05 | Goal lifecycle and completion routes mounted | Hosted tests and saved-week reconciliation |
| API-06 | Workout list, detail and mutation routes mounted | Hosted ownership tests |
| API-07 | Exercise list, detail and mutation routes mounted | Existing mutation implementation is admin-only |
| API-08 | Anonymous and unknown-route cases exercised by the manifest tests | Authenticated create/error contracts not verified |

`013_srs_api_schema.sql` creates the compatibility schema without backfilling existing records. Preview database access requires a server-only `SRS_DATABASE_URL` for the designated staging database. The preview uses the existing explicit route ownership checks; it does not establish a dedicated per-user SQL role or RLS claim context on the Prisma connection.

### Batch 1 verification at commit 4ce0948

- Preview: https://mefit-fitness-planner-lfeam5y88-sukumar9.vercel.app/fitness-api/health
- `SRS_PREVIEW_URL=<preview-origin> node --test tests/fitness-batch.test.mjs`: **44/44**. Health returned 200, all 41 protected route variants returned 401 without authentication, one unsupported query returned 400, and an unknown route returned JSON 404.
- Local: **47/47** manifest and profile-handler checks, **25/25** existing API tests on disposable PostgreSQL, **36/36** frontend tests, lint and build passed. Lint retains existing warnings.
- Migration 013 applied twice on a fresh disposable database. All 16 compatibility tables had RLS enabled.
- Authenticated role and write tests remain pending. The separate compatibility schema does not import the active planner, exercise library, or profiles.

## Batch 2 browser candidate

When `VITE_SRS_API_URL=/fitness-api` is configured, the candidate uses the separate REST profile adapter for current profile data, retrieves roles from the server, and exposes role-gated contributor and administration screens. These screens share `authenticatedRequest`, which retries a 401 once after refreshing Supabase Auth. `apps/web/src/auth/api.test.ts` exercises retry and permission denial. Planner, logging, progress, settings and exercise data still use the existing direct data routes. The preview database connection and real role accounts remain unverified, so the candidate does not count as FE-01, FE-02, or FE-08–FE-11 compliance.

## Batch 3 goal and catalog candidate

| ID | New evidence | Remaining gap |
|---|---|---|
| FE-03 | Dashboard displays the number of calendar days remaining this week. | Production goal details and period-specific progress remain unverified. |
| FE-04 | Existing goal editor calls the shared authenticated REST client; the optional REST configuration activates the route. | Fitness-based suggestions, realistic-goal rules, full custom exercise composition, and hosted persistence still need completion. |
| FE-05 | Chromium fixture check opens a program category and follows a workout inside it. | Catalog uses built-in starter templates. Database-authorable program listing and live verification remain pending. |
| FE-06 | Chromium fixture check opens the workout, verifies the bundled exercise photo, and confirms grouped workout types. | Persisted catalog integration and authenticated live verification remain pending. |
| FE-07 | Chromium fixture check navigates into the existing illustrated catalog. | Hosted verification and explicit grouped listing remain pending. |

Reproduce by running `node tests/e2e/fitness-workspace-qa.mjs` against the loopback frontend fixture. The REST candidate stays opt-in pending verification; existing production data was not migrated.

## Batch 4 release evidence

Production remains on the previously audited release. The 33-item matrix records **0 Met, 27 Partially, and 6 Not met**. Candidate evidence is included without treating it as live proof.

- **DB-02** Supabase reports Free. The candidate GitHub Actions workflow encrypts a daily PostgreSQL dump and requests eight-day retention. A local custom-format restore into disposable PostgreSQL reproduced 16 public tables. A successful Actions run, retained production artifact and hosted restore are pending. See [backup and restore](BACKUP_RESTORE.md).
- **DB-03** Queried production schema metadata for the eight browser-facing tables and verified their foreign keys. The [ERD](assets/production-erd.svg) covers those tables and `auth.users`.
- **SEC-02 and PRF-02** Profile tests check identity overrides, HTTPS avatar validation, and preservation of punctuation and harmless markup as structured data. These checks do not establish end-to-end SQL parameterization or browser output handling on hosted routes. Hosted expired-session and upstream-error flows still need evidence.
- **SEC-04 and PRF-01** Public Vercel landing returned HTTP 200 with HSTS `max-age=63072000; includeSubDomains; preload`. Direct Render health timed out after 22 seconds, so HSTS there remains unverified. The production `/api/user`, `/api/profile`, `/api/goal`, and `/api/exercises` probes each timed out at 18 seconds. Hosted authenticated API timing remains unverified. Mobile Lighthouse on the public landing scored 100/100 for performance, accessibility, best practices, and SEO, with 1.8 s LCP in one run.
- **Verification** 50/50 REST manifest and handler checks, 38/38 frontend tests, lint and TypeScript build passed. Lint retains existing warnings. Production dependency audit found zero known vulnerabilities.
- **Live smoke** Public landing, sign-in and registration rendered. Signed-in regular-user, contributor and administrator smoke tests remain blocked because the hosted REST preview has no verified staging database binding or dedicated accounts for those roles.

The Batch 4 preview at commit `430ac15` returned JSON health and passed 46/46 anonymous REST checks. The separate backend suite passed 25/25 against the disposable loopback database. The direct Render HTTPS retry also timed out at 35 seconds. [Verified Vercel preview](https://mefit-fitness-planner-h8ssijw6t-sukumar9.vercel.app/)
