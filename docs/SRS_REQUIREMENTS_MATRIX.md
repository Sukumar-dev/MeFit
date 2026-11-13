# SRS Requirements Traceability Matrix

This is the working trace from the client's 25-page SRS and master development requirements. “Implemented” means code exists; a requirement is not “verified” until an automated or manual check proves the behavior. Current test evidence and remaining checks are recorded below and in `PROGRESS.md`.

| ID | SRS requirement | Implementation | Verification/evidence | Status |
|---|---|---|---|---|
| FE-01 | Sign-in, registration, protected access, USER/CONTRIBUTOR/ADMIN roles; admin inherits contributor | `apps/web/src/auth`, `apps/api/src/auth`, Keycloak realm | API JWT/role tests; Playwright registration, TOTP, callback provisioning and contributor denial pass. Returning login/logout and admin/contributor grant journeys pending | In progress |
| FE-02 | User indicator, logout, navigation, contributor navigation by role | `apps/web/src/App.tsx`, `AuthProvider.tsx` | Registration reaches authenticated dashboard; role denial tested. Logout and role-based visible navigation not yet directly asserted | In progress |
| FE-03 | Dashboard calendar/current day, weekly progress, days left, workout detail and goal setting | `App.tsx`, `pages/GoalsPage.tsx`, `apps/api/src/routes/goals.ts` | Playwright creates a weekly goal, completes workout, and observes 100% completed state | Implemented; partial verification |
| FE-04 | Goal dates/status/history, combine program/workouts/exercises, custom workouts, completion, suitability warning | `pages/GoalsPage.tsx`, `routes/goals.ts`, schema `Goal*` models | Custom goal creation/completion E2E pass; program/workout combination, history, overlapping periods, suitability warnings need further tests | In progress |
| FE-05 | Programs grouped by category with contained workout detail | `pages/CatalogPage.tsx`, `routes/catalog.ts` | API PostgreSQL test and authenticated UI search/detail E2E pass | Implemented |
| FE-06 | Workouts grouped by type with exercise/set detail | `pages/CatalogPage.tsx`, `routes/catalog.ts` | API PostgreSQL detail test verifies ordered movements and sets; browser-specific detail pending | Implemented; partial verification |
| FE-07 | Exercises grouped by target muscle and item detail | `pages/CatalogPage.tsx`, `routes/catalog.ts` | API PostgreSQL test verifies grouping, search and detail; browser exercise detail pending | Implemented; partial verification |
| FE-08 | Contributors create/edit/archive programs and choose workouts | `pages/ContributorPage.tsx`, `routes/contributor.ts` | Builds/lint; protected-route checks pass; authenticated ownership CRUD pending | In progress |
| FE-09 | Contributors create/edit/archive workouts with exercise sets | `pages/ContributorPage.tsx`, `routes/contributor.ts` | Builds/lint; protected-route checks pass; authenticated ownership CRUD pending | In progress |
| FE-10 | Contributors create/edit/archive exercises | `pages/ContributorPage.tsx`, `routes/contributor.ts` | HTTPS URL validation in API schema; builds/lint; authenticated ownership CRUD pending | In progress |
| FE-11 | Required/editable profile, fitness evaluation, account details, contributor request, 2FA | `pages/ProfilePage.tsx`, `routes/profiles.ts`, `routes/contributor-requests.ts`, Keycloak | TOTP registration and authenticated profile update/read persistence E2E pass; contributor request, profile deletion and account link pending | In progress |
| API-01 | Search is the only supported query parameter | `routes/catalog.ts` | Test confirms unsupported query returns 400 and search filters seeded content | Implemented |
| API-02 | JSON login, failed auth 401, temporary source-rate limiting | `routes/login.ts`, `auth/authorization.ts` | Login tests cover valid/malformed/untrusted redirect; auth tests cover 401 and JWT validation | Implemented; E2E pending |
| API-03 | User read/update/delete, password route, admin-only roles, ownership | `routes/users.ts` | Build/lint; admin endpoints require auth; authenticated ownership integration pending | In progress |
| API-04 | Profile CRUD | `routes/profiles.ts` | Authenticated browser test persists and reads profile; DELETE and edge validation still need direct route tests | In progress |
| API-05 | Goal CRUD, current state, completion/history | `routes/goals.ts` | Authenticated browser create/complete flow and PostgreSQL current status observed; history, conflict, and authorization ownership tests pending | In progress |
| API-06 | Workout detail/create/update/delete, contributor authorization/ownership | `routes/catalog.ts`, `routes/contributor.ts` | Catalog detail test; mutation auth/ownership integration pending | In progress |
| API-07 | Exercise list/detail/create/update/delete | `routes/catalog.ts`, `routes/contributor.ts` | Exercise list/detail/search test; mutation auth/ownership integration pending | In progress |
| API-08 | Correct status codes, logs, generic production errors | `app.ts`, `logger.ts`, route handlers | Health/not-found, login, auth and input paths covered by API tests; centralized production error audit remains | In progress |
| DB-01 | Persistent controlled PostgreSQL storage | `apps/api/prisma/schema.prisma`, migration, `db.ts` | PostgreSQL readiness and seeded row counts passed; app integration tests run against PostgreSQL | Implemented |
| DB-02 | Daily complete backup, at least 7-day retention | `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh`, `docs/BACKUP_RESTORE.md` | Scripts implemented; backup run, daily scheduler, durable destination, and restore drill not verified | In progress |
| DB-03 | Normalized relational schema based on ERD | Prisma schema and `docs/DATABASE_SCHEMA.md` | Prisma generation/migration applied; database seed persists | Implemented |
| SEC-01 | Bearer token authorization, 2FA, auth rate limits | Keycloak realm, `auth/authorization.ts`, login route | Wrong-audience JWT and role behavior tests pass; browser TOTP callback and API token provisioning pass | Implemented; partial verification |
| SEC-02 | Validate/sanitize input against XSS/injection | Zod route schemas; React text rendering | Login/catalog/profile validation tests; full mutation validation suite pending | In progress |
| SEC-03 | No secrets in source; environment configuration | `.env.example`, `.gitignore`, scripts | Local `.env` ignored; repository secret scan pending | In progress |
| SEC-04 | HTTPS public deployment | Deployment configuration not yet created | No production hosting/domain available | Not started |
| PRF-01 | Responsive, responsive interactions, no hanging requests | Tailwind layouts; bounded login/profile requests; catalog search debounce | Production frontend build passes; viewport/performance checks pending | In progress |
| PRF-02 | Useful safe errors | Per-route user-safe JSON and form alerts | Unit and API error paths checked; browser review pending | In progress |
| DOC-01 | Screenshot user manual covering each action | `docs/USER_MANUAL.md`, `docs/assets/` | Screenshots cover profile, dashboard, catalog, goal creation/completion; role-only screens are described but not captured | In progress |
| DOC-02 | Detailed API reference | `docs/API_DOCUMENTATION.md` | Core endpoint reference drafted; route-by-route contract audit pending | In progress |
| DOC-03 | README and clean install instructions | `README.md`, `docs/INSTALLATION.md` | Install commands documented and local services verified; clean-machine walkthrough pending | In progress |
| MISC-01 | Git repository, code/docs and live deployment | Workspace and `docs/SECURITY_DEPLOYMENT.md` | Git repository initialized and project files present; no production deployment or remote configured | In progress |
| MISC-02 | 30-minute presentation/demo/Q&A | `docs/PRESENTATION.md` | Timed 30-minute talk/demo/Q&A outline prepared | Implemented; partial |

## Current verification record

- API: 22 tests passed across 8 files (`npm test`).
- Web: 1 test passed (`npm test`).
- Playwright: 7 tests passed, covering protected routes, login/registration provider handoff, TOTP registration and user provisioning, profile persistence, catalog search/detail, goal create/completion, and contributor access denial.
- Production builds and linters pass (`npm run build`, `npm run lint`).
- Authenticated administrator review and contributor CRUD remain unverified; production deployment, mobile/a11y manual QA, screenshot guide, and backup restore drill are outstanding.
