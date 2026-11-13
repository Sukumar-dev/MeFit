# MeFit Demonstration Plan (30 minutes)

## Audience and goal

Show how MeFit turns a user’s weekly availability into a saved plan, demonstrates the API/database design, and explains the access controls and remaining production work.

## Run of show

| Time | Segment | Demonstration |
|---:|---|---|
| 0–2 min | Problem and scope | Introduce the client SRS, user personas, and verified local-only status. |
| 2–5 min | Architecture | React/Vite, Express/TypeScript, Prisma/PostgreSQL, Keycloak OIDC PKCE/TOTP, and Docker Compose. |
| 5–9 min | Account security | Register a test account, complete TOTP setup, show callback provisioning and role-protected routes. |
| 9–13 min | Fitness profile | Save readiness preferences and physical/address details; explain the versioned non-clinical score and warning. |
| 13–17 min | Catalog | Search programs, workouts, exercises; inspect a program and ordered workout detail. |
| 17–22 min | Weekly goal | Create a custom or catalog-based plan; mark sessions complete; show progress and completed state. |
| 22–25 min | Contributor/admin | Walk through request/review, role grants, content authoring, ownership, and archive behavior. Use a role-enabled local account; note if this workflow is not live-verified. |
| 25–27 min | Data and API | Review schema, audit records, status codes, readiness endpoint, and backup/restore scripts. |
| 27–29 min | Tests and known gaps | Report current automated results and unverified role, accessibility, restore, and deployment items. |
| 29–30 min | Q&A / decisions | Confirm production domain/host, email/media providers, retention, admin account, and launch expectations. |

## Demo preparation

1. Follow `INSTALLATION.md`; verify `/health`, `/ready`, PostgreSQL and Keycloak.
2. Confirm the realm mapper setup script succeeds. Keep test credentials and real personal data out of the recording.
3. Create a disposable test user and complete TOTP setup. For administrator screens, register the approved local admin, set `MEFIT_ADMIN_EMAIL` in `.env`, and run `scripts/bootstrap-local-admin.sh`.
4. Seed the catalog and prepare one short goal. Avoid relying on pre-existing user state or the current calendar date.
5. Have `TEST_REPORT.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, and `SRS_REQUIREMENTS_MATRIX.md` ready for questions.

## Discussion prompts

- Which hosting provider/domain should production use?
- Which email and media-storage services are approved?
- What are availability, backup RPO/RTO, data-retention, and privacy expectations?
- Who owns initial and ongoing administrator access?
- Should the client define a specific fitness-evaluation formula or keep the documented non-clinical planning score?
