# MeFit

MeFit is a full-stack fitness planning application. Members can build personalized goals, plan weekly workouts, browse exercise programs, and track progress. Contributors manage library content, and administrators review contributor requests and manage access.

## Features

- Registration and sign-in through OpenID Connect with PKCE and TOTP MFA
- User-specific profiles, fitness goals, workout plans, and completion history
- Exercise, workout, and program library with exercise-specific image references
- Contributor content management and administrator review tools
- PostgreSQL persistence, Prisma migrations, API validation, and authorization
- Responsive React interface with browser, API, and unit tests

## Technology

- **Web:** React, TypeScript, Vite, Tailwind CSS, React Router
- **API:** Node.js 22+, TypeScript, Express 5, Zod
- **Data:** PostgreSQL 17, Prisma ORM
- **Identity:** Keycloak / OpenID Connect, PKCE, TOTP MFA
- **Verification:** Vitest, Testing Library, Supertest, Playwright

## Local setup

Prerequisites: Node.js 22.12+, npm, Docker Desktop, and Docker Compose. The sample `.env` contains a clearly marked local-only placeholder; replace it before sharing this development stack.

```sh
cp .env.example .env
npm install
docker compose -f infra/docker-compose.yml up -d
npm run db:generate
npm run db:migrate
npm run db:seed
bash scripts/configure-local-keycloak.sh
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`, Keycloak at `http://localhost:8080`, and PostgreSQL at `localhost:5432`. Local credentials in `.env.example` are for development only. See [installation](docs/INSTALLATION.md) for first-user and administrator setup.

## Quality checks

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

## Repository layout

```text
apps/web/          React web client and its container build
apps/api/          Express API, Prisma schema/migrations, and its container build
infra/             Local PostgreSQL/Keycloak Compose setup and development realm
docs/              Architecture, API, setup, requirements, operations, and user guides
scripts/           Local identity setup and encrypted database backup utilities
tests/e2e/         Playwright user journeys
```

## Production deployment

The production containers are `apps/web/Dockerfile` and `apps/api/Dockerfile`. The web image builds the Vite client with public API and OIDC URLs, then serves it through Nginx with SPA route fallback. The API image generates Prisma Client, builds the API, applies committed migrations at startup, and listens on the platform-provided port. Do not pass credentials as Docker build arguments; inject them as service runtime secrets.

The stack needs a public web origin, an API service, durable PostgreSQL, and a production OIDC provider (Keycloak is supported). Configure exact HTTPS redirect and post-logout URLs on the identity client, configure the API audience, and allow the web origin in API CORS. Set the `VITE_*` values at frontend **build** time and API/database/OIDC values as backend **runtime** variables. The development realm under `infra/keycloak/` is for local use and must not be imported into production.

See [Render trial deployment](docs/RENDER_DEPLOYMENT.md) for the current free-tier Blueprint, database setup, and environment variables. The Render free database expires and has no backups; this configuration is for evaluation, not production use. Do not use local `.env` credentials or local user data in a hosted environment.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API_DOCUMENTATION.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Installation](docs/INSTALLATION.md)
- [Production deployment preparation](docs/PRODUCTION_DEPLOYMENT.md)
- [Render trial deployment](docs/RENDER_DEPLOYMENT.md)
- [Security and deployment readiness](docs/SECURITY_DEPLOYMENT.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [SRS requirements matrix](docs/SRS_REQUIREMENTS_MATRIX.md)
- [Progress report](docs/PROGRESS.md)
- [Test report](docs/TEST_REPORT.md)
- [User guide](docs/USER_MANUAL.md)

## Security and privacy

Never commit `.env`, access tokens, passwords, private keys, production certificates, database backups, or real user health information. The client SRS PDF is intentionally excluded from Git; it is not required to build or run the application. Production requires HTTPS, unique secrets, a verified email delivery path, a durable encrypted backup destination, and an operational identity-provider policy.

## Team and participants

Fill in team member names, participant IDs, and responsibilities before submission.
