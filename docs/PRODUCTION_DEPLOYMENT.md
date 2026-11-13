# Production Deployment Preparation

This is a deployment checklist and configuration map, not a claim that MeFit is online. It assumes a container platform such as Railway with one web service, one API service, a durable PostgreSQL database, a separate PostgreSQL database for Keycloak, and a Keycloak service. Use separate database credentials for MeFit and Keycloak. Do not import the local development realm into production.

## Service topology

| Service | Build / image | Public? | Health check |
| --- | --- | --- | --- |
| Web | `apps/web/Dockerfile` | Yes, HTTPS | `/` |
| API | `apps/api/Dockerfile` | Yes, HTTPS | `/ready` |
| MeFit PostgreSQL | Managed PostgreSQL | No; private network only | Provider health |
| Keycloak PostgreSQL | Managed PostgreSQL, separate credentials | No; private network only | Provider health |
| Keycloak | Official Keycloak 26 image, production `start` mode | Yes, HTTPS | `/health/ready` |

Configure generated/custom domains before setting origins. The API must be reachable from the user's browser, and the OIDC issuer must be a stable public HTTPS origin. Database URLs should use private service networking.

## Build services

Create a frontend service from the repository with Dockerfile path `apps/web/Dockerfile`. Its public Vite values are build-time configuration:

| Variable | Example shape |
| --- | --- |
| `VITE_API_URL` | `https://<api-domain>/api` |
| `VITE_OIDC_AUTHORITY` | `https://<auth-domain>/realms/mefit` |
| `VITE_OIDC_CLIENT_ID` | `mefit-web` |
| `VITE_OIDC_REDIRECT_URI` | `https://<web-domain>/auth/callback` |

The frontend Docker build fails if the API URL, OIDC authority, or callback URI is missing. These values are public URLs/client identifiers, not secrets. Logout redirects to `<web-origin>/login`.

Create an API service from Dockerfile path `apps/api/Dockerfile`. It runs `prisma migrate deploy` before starting. Configure:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` |
| `PORT` | Injected by the platform; API binds to `0.0.0.0` |
| `WEB_ORIGIN` | Exact HTTPS frontend origin, without a trailing slash |
| `API_PUBLIC_ORIGIN` | Exact HTTPS API origin, without a trailing slash |
| `DATABASE_URL` | Private PostgreSQL connection string, stored as a secret |
| `OIDC_ISSUER` | Exact Keycloak issuer, for example `https://<auth-domain>/realms/mefit` |
| `OIDC_AUDIENCE` | `mefit-api` |
| `MEFIT_ADMIN_EMAIL` | Optional operator email used only if the existing admin-bootstrap process requires it |

The platform should expose `/health` for liveness and `/ready` for readiness. `/ready` checks PostgreSQL connectivity. Protect the API with TLS and exact-origin CORS; do not set `WEB_ORIGIN=*`.

## Keycloak production setup

Use a durable, separate PostgreSQL database. Run the official Keycloak image in production `start` mode, never `start-dev`, and provide the database settings, HTTPS public hostname, and a unique bootstrap administrator credential through the hosting platform's secret manager. Set `KC_HTTP_ENABLED=true` only when the trusted platform ingress terminates HTTPS and forwards proxy headers correctly; configure Keycloak's proxy-header mode to match the platform.

Create a production `mefit` realm and configure:

- A public `mefit-web` client with Authorization Code flow and PKCE S256; disable implicit and direct access grants.
- Exact redirect URI `<web-origin>/auth/callback`, post-logout redirect `<web-origin>/login`, and web origin `<web-origin>`.
- An API audience mapper issuing `mefit-api` in access tokens, plus `sub`, email, given name, family name, and realm role claims.
- Required TOTP enrollment, verified email, password reset, brute-force protections, administrator recovery, and signing-key rotation.
- Production SMTP settings for verification and password recovery. Test delivery before opening registration.

Do not import `infra/keycloak/mefit-realm.json` in production: it is explicitly for localhost development. Ensure `OIDC_ISSUER` exactly matches the realm's discovery document issuer and the `iss` claim. The API validates issuer, signature, audience, subject, email, and roles.

## Database and operations

- Use managed PostgreSQL with encryption at rest, private networking, restricted credentials, and a documented recovery point/time objective.
- Migrations are applied by the API start command. Before first production launch, take a provider snapshot and review the pending migration list.
- Seed data is a local development action; do not run `db:seed` against the production database unless the owner explicitly asks for approved catalog seed records.
- Configure independent encrypted backups and retention, alert on failed backups, and schedule a restore drill. Do not write backups only to the container filesystem.
- Set platform spending limits/alerts before enabling public traffic. Monitor API errors, database capacity, authentication events, and service health.
- Provide a privacy notice, support contact, user data retention policy, and account deletion process before inviting public users.

## Pre-launch checklist

- [ ] GitHub repository exists as private and contains no `.env`, local credentials, backups, or client SRS PDF.
- [ ] Production domains resolve and HTTPS is active for web, API, and identity provider.
- [ ] Web build uses production API and OIDC URLs; no localhost URL remains in built assets.
- [ ] Keycloak has the production realm/client/audience/TOTP/email configuration above.
- [ ] API and both databases use independent generated secrets and private networking.
- [ ] Migrations reviewed and applied; `/health` and `/ready` pass.
- [ ] Admin access is assigned to the intended operator; registration/login and user isolation pass.
- [ ] Backup, alerting, rollback, and restore procedures are tested.
- [ ] Production smoke tests pass on desktop and mobile.

## Not configured yet

The deployment owner must connect the hosting account, choose/approve a paid plan if needed, set the production domains, create identity/database services, enter the secret values, provision SMTP, and select the production administrator. Do not paste secret values into Git, this README, or chat. This deployment preparation must be completed before a live release can be claimed.
