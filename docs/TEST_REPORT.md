# Test Report

Date: 2026-11-12 (local development environment)

## Automated results

| Check | Result | Coverage |
|---|---:|---|
| API tests (`npm --workspace apps/api test`) | 22 passed / 8 files | PostgreSQL seeded catalog/readiness; auth JWT signature/audience/roles; login validation; protected goal/profile/contributor/admin routes; health and readiness |
| Web tests (`npm --workspace apps/web test`) | 1 passed | Auth page and registration/login flow rendering |
| Playwright (`npm run test:e2e`) | 7 passed | Protected-route behavior; Keycloak login and registration handoff; TOTP setup; callback, token verification and user provisioning; profile persistence; catalog search/program details; custom goal completion; regular-user contributor denial |
| Production build (`npm run build`) | Passed | API TypeScript compilation and optimized Vite frontend build |
| Lint/type checks (`npm run lint`) | Passed | API TypeScript and frontend Oxlint |
| Keycloak local setup | Passed | Realm JSON parses; mapper configuration script succeeds on the running local realm |
| PostgreSQL | Passed | Compose services healthy; migration applied; 8 exercises, 4 workouts, 2 programs seeded; readiness check passed |

## Coverage not yet demonstrated

- Returning-user login, logout, token expiry, account disable, and password handoff browser flows.
- Administrator browser flow for request approval/rejection, role assignment, account listing, and role revocation.
- Contributor browser create/edit/archive for exercises, workouts with sets, and programs; ownership denial across two contributors.
- Profile deletion, optional address round-trip, HTTPS image validation in the browser, contributor request submission/review.
- Goal program/workout combinations, history, overlap errors, invalid timezone/date paths, suitability warnings, and other-user isolation.
- Mutation and audit-log database integration tests beyond the E2E-tested profile/goal flows.
- Mobile viewport, screen-reader/keyboard accessibility, load/performance, security scan, clean-workspace installation, and production infrastructure.
- Backup execution, daily scheduling, remote retention, and restore drill.

## Environment notes

Tests ran on Apple Silicon macOS with Node.js 25.2.1, npm 11.6.2, PostgreSQL 17, Keycloak 26.3, and Chromium. The supported minimum in package manifests is Node >=22.12; Node 22 LTS is the recommended team baseline.
