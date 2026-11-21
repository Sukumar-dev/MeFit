# Separate Keycloak staging service

This setup adds a **new staging-only Keycloak** and a separate staging API. It does not change `render.yaml`, the existing production Keycloak, the production API, or Supabase Auth settings. The staging API keeps using the Supabase staging Postgres database; Keycloak itself uses its own persistent Postgres database.

## What the new staging realm does

- Realm: `mefit`; browser client: `mefit-web`; API audience: `mefit-api`.
- Registration is enabled. Email verification and email password reset are disabled, so the basic register/sign-in flow does not need an SMTP sender.
- TOTP setup is a default required action. Users can enroll an authenticator app when they first sign in.
- Google and Microsoft are not enabled by importing this realm. Each needs an OAuth app and its client ID/secret configured in the staging Keycloak identity-provider settings. Do not copy those credentials into Git.
- A copied staging realm template is expanded at container startup with the exact `MEFIT_STAGING_WEB_ORIGIN`; this keeps redirect URIs limited to that staging frontend origin.

If email verification or password-reset emails are desired, configure a real SMTP provider on **the staging Keycloak** and then enable the relevant realm settings. No SMTP values are needed for the realm as currently configured.

## Create the staging services

1. Create a separate persistent Postgres database for staging Keycloak in Neon (or another persistent PostgreSQL provider). Do not reuse the production Keycloak database. Copy its **direct** connection hostname, database name, username, and password privately.
2. In Render, create a **new Blueprint instance** from `render.keycloak-staging.yaml`. Do not import it over `render.yaml` or select the existing production services.
3. In the new `mefit-auth-staging-sukumar` service, set these values in Render's Environment page:
   - `KC_DB_URL`: `jdbc:postgresql://<direct-host>/<database>?sslmode=require&connectTimeout=30&tcpKeepAlive=true`
   - `KC_DB_USERNAME`: the staging database username
   - `KC_DB_PASSWORD`: the staging database password
   - `MEFIT_STAGING_WEB_ORIGIN`: the exact HTTPS origin of the staging Vercel Preview, with no path or trailing slash
4. In the new `mefit-api-keycloak-staging-sukumar` service, set:
   - `DATABASE_URL`: the **Supabase staging project's session-pooler** connection string on port 5432. Do not use the production database.
   - `WEB_ORIGIN`: the same exact staging Vercel Preview origin
5. Leave the API Docker Command at the Blueprint's safe `npm --workspace apps/api run start` until the staging Prisma migrations have been baselined. Never use a production connection string for baselining. The Supabase staging database previously had its Prisma schema but no `_prisma_migrations` history, so the migration baseline must be completed and verified separately before using `start:prod`.
6. Set the Vercel **Preview** environment variables, then redeploy a real Preview from the staging branch:

   | Variable | Value |
   | --- | --- |
   | `VITE_AUTH_PROVIDER` | `keycloak` |
   | `VITE_OIDC_AUTHORITY` | `https://mefit-auth-staging-sukumar.onrender.com/realms/mefit` |
   | `VITE_OIDC_CLIENT_ID` | `mefit-web` |
   | `VITE_OIDC_REDIRECT_URI` | `<staging-origin>/auth/callback` |
   | `VITE_API_URL` | `https://mefit-api-keycloak-staging-sukumar.onrender.com/api` |

   Remove Supabase Auth variables from **Preview only** if present. Do not change Production variables as part of staging setup. Confirm Vercel identifies the deployment as Preview before using its origin; the current project has previously treated the `codex/supabase-staging` branch as a Production deployment, so first correct the Vercel Production Branch setting or choose a separate staging project. Do not push this branch while it can deploy to Production.

## Verify before inviting testers

1. In Render, confirm both service names include `staging`; inspect startup logs for the production profile, Postgres connection, successful one-time import of realm `mefit`, and listening port `10000`. Confirm no JDBC errors, OOM events, or restart loop.
2. Open `https://mefit-auth-staging-sukumar.onrender.com/realms/mefit/.well-known/openid-configuration`; check the issuer is exactly `https://mefit-auth-staging-sukumar.onrender.com/realms/mefit` and endpoints use HTTPS.
3. Test account registration, TOTP enrollment, sign-out/sign-in with TOTP, callback, `/ready`, and a protected API request from the Vercel Preview. Verify missing, invalid, and expired tokens are rejected.
4. Confirm registration and authenticator-based login work without SMTP. If users need email verification or recovery, configure and test SMTP before enabling those features.

## Limits and remaining dashboard work

Render access is not connected to this workspace, so these files prepare the new stack but do not create or deploy Render services. A person with Render access must create the Blueprint, provide the private database credentials, and configure the staging API database URL. A person with Neon access must create the separate Keycloak database. Vercel must have a true Preview environment and correct branch protection before any staging deployment is made.

Both new Render services use the Free plan. Free services can sleep when idle, and Keycloak may take a long time to wake; a second Keycloak does not remove that platform behavior or the prior 512 MiB memory risk. This stack is for staging validation, not a guarantee of 24/7 production availability.
