# Local Installation (Apple Silicon macOS)

## Prerequisites

- macOS on Apple Silicon
- Node.js 22.12 or newer and npm (the inspected Mac has Node.js 25.2.1/npm 11.6.2)
- Docker Desktop with Compose v2
- Git for future clone-based setup

Use local-only credentials in `.env`; replace the `CHANGE_ME_LOCAL_ONLY` placeholders before starting services. Keep that file untracked. Docker provides PostgreSQL 17 and Keycloak 26; the web and API processes run on the host.

## First setup

From the project root:

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

Open `http://localhost:5173`. Keycloak is at `http://localhost:8080`, PostgreSQL at `localhost:5432`, and API at `http://localhost:4000`. Health checks are `GET http://localhost:4000/health` and `/ready`.

The local realm enables self-registration and requires TOTP setup. The setup script installs API audience, subject, email, username, and realm-role mappers on the public web client. After registering the designated administrator account, set `MEFIT_ADMIN_EMAIL` in `.env` and run `bash scripts/bootstrap-local-admin.sh` to assign its MeFit ADMIN role. A development-only Keycloak admin login is described by `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` in `.env.example`; change those values before sharing this environment. Never use these local credentials for deployment.

## Tests and maintenance

```sh
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

Stop local services with `docker compose -f infra/docker-compose.yml down`. This retains the named persistent PostgreSQL and Keycloak volumes; `down -v` would delete those data volumes and should only be used when intentionally resetting the local database.

## Deployment prerequisites

Public hosting is not configured. Before deployment, set production HTTPS origins, provision a production identity realm, create unique secrets, configure email verification/reset, object/media storage, persistent PostgreSQL, encrypted remote backups and scheduler, health checks, and restore monitoring. See `BACKUP_RESTORE.md` for local backup/restore commands.
