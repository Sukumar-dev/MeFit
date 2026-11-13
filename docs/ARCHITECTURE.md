# MeFit Architecture

## Source of requirements

The client SRS (`MeFit Case-SITER.pdf`, 25 pages) is the functional source of truth. The master development brief adds implementation and delivery criteria. Where the approved planning response recommended ASP.NET Core but this later brief names Node.js/TypeScript/Express/Prisma as its preferred stack, this implementation follows the later, more specific stack preference because this repository has no existing application to preserve.

## System overview

- **Web client:** React + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Recharts, Lucide React.
- **API:** Node.js + TypeScript + Express, Zod validation, Prisma ORM, PostgreSQL, structured logging, centralized errors, OpenAPI documentation.
- **Identity:** OIDC Authorization Code + PKCE against a local Keycloak service in development, with TOTP MFA required by the application. The API validates signed bearer tokens and enforces authorization. A compatibility `POST /login` endpoint starts the OIDC authorization flow; credentials are never collected by the MeFit API.
- **Storage:** PostgreSQL is authoritative for all application domain data. Keycloak stores identity-provider credentials and MFA configuration. Uploaded images use a configured media store; profile/media metadata is persisted in PostgreSQL.
- **Local services:** Docker Compose for PostgreSQL and Keycloak; application processes run on the host for fast iteration and lower memory use.
- **Production:** HTTPS reverse proxy, managed or containerized PostgreSQL, environment-injected secrets, health checks, daily encrypted backups retained for at least seven days.

## Trust boundaries and authorization

The browser is untrusted. Every input is validated in the API; database access uses Prisma parameterized operations. API authorization checks role and resource ownership on every protected operation. Roles are `USER`, `CONTRIBUTOR`, and `ADMIN`; `ADMIN` implies contributor permissions. Users can access their own profiles, goals, and account settings. Administrative role changes and user administration require `ADMIN`. Catalog edits require `CONTRIBUTOR`; deletion is limited to the content owner except for an explicitly authorized administrative action.

## Repository layout

```text
mefit/
├── apps/
│   ├── web/src/              # React/Vite routes, auth, pages, tests
│   └── api/
│       ├── prisma/           # Prisma schema, migrations, seed
│       ├── src/routes/       # API resource handlers
│       ├── src/auth/         # OIDC bearer validation and authorization
│       └── test/             # Vitest/Supertest tests
├── infra/
│   ├── docker-compose.yml    # PostgreSQL + Keycloak
│   ├── keycloak/             # Imported local realm configuration
│   └── keycloak-config/      # Repeatable local mapper configuration
├── docs/                     # Architecture, SRS, API, setup, progress
├── tests/e2e/                # Playwright browser flows
├── scripts/                  # Local Keycloak, backup and restore operations
├── .env.example
├── package.json
└── README.md
```

## API conventions

API base path is `/api`. Resource IDs are opaque UUIDs. JSON is used for API request and response bodies. Query parameters are disallowed except for search. Collection filters use path segments or a validated JSON search body. Created resources return `201 Created` and `Location`; invalid input returns `400`; unauthenticated requests return `401`; authenticated unauthorized requests return `403`; missing records/routes return `404`; conflicting duplicate operations return `409`; rate limiting returns `429`; production `500` responses contain no internal details. `GET /user` responds `303 See Other` to the authenticated user's user resource URL as required by the SRS.

## Explicit product assumptions

1. OIDC provider handles registration, password changes, sessions, and TOTP. `POST /login` redirects into OIDC and does not accept a password. This resolves the SRS's legacy login/password endpoint language without exposing credentials to the application API.
2. MFA enrollment is required before protected application use, as requested in the master brief's interpretation of the SRS security requirement.
3. A goal is a seven-day interval beginning on the selected local date; the user profile's configured IANA timezone determines calendar dates. Past and future starts are allowed, but only one active goal may overlap for a user. This can be revisited if client clarification arrives.
4. Goal workouts are snapshots of assigned workout/exercise prescriptions so later catalog edits do not rewrite historical goals.
5. Completion is one unique record per goal-workout assignment. Progress is completed assignments / total assignments; empty goals cannot be saved.
6. Fitness evaluation is a transparent, configurable activity/readiness questionnaire and flags missing or self-reported constraints for conservative recommendations. It is not a diagnosis and does not use invented clinical cutoffs. Users may override suggestions; warnings explain their basis.
7. Medical and fitness attributes are private to the account owner and authorized administrators only, and are minimized to fields required for the SRS features.
8. Catalog deletion is restricted when referenced by history; archive/soft-delete is preferred to preserve referential integrity.

## Initial environment inspection

At project start, the workspace contained the 25-page SRS and no application or Git repository. The Mac is Apple Silicon with 16 GB RAM; Node.js 25.2.1/npm 11.6.2 and .NET 10.0.106 were present. Docker Desktop was available. Node 22 LTS is the recommended baseline, while current package engine requirements allow Node >=22.12. Local services now run in Docker Compose and the schema migration/seed have been applied.
