# MeFit: Supabase Auth/Postgres + Vercel frontend

This migration keeps the Express API on Render for the first phase. The React/Vite app is hosted as a static site on Vercel; Supabase provides Auth and PostgreSQL. Keep the current Keycloak production variables until the Supabase project, database, and frontend are configured and verified.

## Configure Supabase

1. Create a Supabase project and save its project URL, publishable key, database password, and database connection strings securely.
2. In **Authentication → URL Configuration**, add the deployed Vercel URL with `/auth/callback` as an allowed redirect URL. Add the localhost callback URL for development.
3. Keep email confirmation enabled. Configure a production SMTP sender before inviting real users; the built-in mailer is for limited testing.
4. In **Authentication → Signing Keys**, configure an asymmetric ES256 or RS256 signing key for user access tokens. The API validates tokens using the project's public JWKS endpoint; legacy shared-secret JWT signing cannot be validated through JWKS.
5. Use the Supabase shared **session pooler** connection string for Render's database URL if the Render runtime cannot reach Supabase's IPv6-only direct endpoint. Copy the exact host and username from Supabase's Connect dialog; use port `5432` (session mode), not transaction mode.
6. Back up the existing MeFit PostgreSQL database before importing it into Supabase. Restore the existing `public` application schema and records into the new project, then run the repository's Prisma migrations with `npm --workspace apps/api run db:deploy`. Do not overwrite Supabase-managed `auth` or `storage` schemas. The migration does not transfer Keycloak credentials; users must register/reset passwords in Supabase, and existing data is re-linked by verified matching email on first sign-in.

## Set Render API environment

Keep the current Render deployment while switching only after the Supabase schema and data are ready:

```text
AUTH_PROVIDER=supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
SUPABASE_JWT_ISSUER=https://<project-ref>.supabase.co/auth/v1
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_AUDIENCE=authenticated
DATABASE_URL=<Supabase shared session-pooler URL on port 5432>
WEB_ORIGIN=<exact deployed Vercel origin>
```

`SUPABASE_JWT_ISSUER` and `SUPABASE_JWKS_URL` can be omitted because the API derives them from `SUPABASE_URL`. Keep the `DATABASE_URL` password private. Configure the Render start command to run Prisma migrations before starting the API (the repository's `start:prod` script does this), then check logs before switching the public frontend.

## Set Vercel project and environment

Import the Git repository into Vercel with the repository root as the project root. The root `vercel.json` builds the `apps/web` workspace and serves its `dist` directory with SPA routing.

Set these Production and Preview environment values in Vercel (use your real URLs):

```text
VITE_AUTH_PROVIDER=supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
VITE_API_URL=https://<existing-render-api-origin>/api
```

The publishable key is intended for browser use. Never put the Supabase secret/service-role key in Vercel's `VITE_*` variables or in the frontend. Add the Vercel origin to Supabase's redirect allow list and set the exact same origin as Render's `WEB_ORIGIN` for API CORS.

## Cutover and rollback

1. Confirm Prisma migrations and restored application data in Supabase.
2. Apply the Render environment values and deploy the API. Confirm `/health` returns 200 and API logs have no PostgreSQL or JWKS validation errors.
3. Deploy Vercel with the Supabase environment values. Test account creation, email callback, first-time TOTP enrollment, next sign-in with TOTP, password reset, protected API calls, and an existing account with matching verified email.
4. Keep the old Keycloak service and old database untouched through the observation period. Roll back the frontend and API provider variables to Keycloak if verification fails.

This does not remove Render's free-instance sleep for the Express API. Static pages and Supabase sign-in should remain available, but first-time account provisioning and API data requests may still wait for the Render API to wake. Supabase free projects also have usage limits and may pause after extended inactivity; this setup improves the current Keycloak failure mode but does not promise 24/7 uptime on free tiers.
