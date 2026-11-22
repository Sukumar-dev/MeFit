# Account linking, deployment, and rollback

Production remains on hold. The database migration and deployment require separate explicit approvals. The current Vercel rollback target is `dpl_GLV2sU7CcCmnX4GZJivvqUZuq2cq`.

## Account linking and SQL review

When a confirmed Supabase email belongs to an existing MeFit account, the app opens the linking screen after Supabase two-step verification. The user confirms the displayed email and signs in again through Keycloak. Keycloak uses authorization code with PKCE. The callback correlates the OAuth state with the original Supabase identity, rechecks the active session, and sends the Keycloak access token directly to the API in a POST body. The API verifies both providers' tokens and checks the confirmed Supabase email against the legacy account record.

The [exact migration](../../apps/api/prisma/migrations/20261122150000_add_supabase_identity_links/migration.sql) creates only `SupabaseIdentity`. Its composite primary key makes each issuer and subject unique. A unique index on `userId` allows one Supabase link per account. The foreign key references the existing MeFit `User.id`. It prevents orphan links and removes a link if its parent is later deleted. Row-level security is enabled on the link table with no client policies. The migration includes no data manipulation or backfill. It leaves existing user IDs, sign-in subjects, roles, profiles, and addresses intact.

## Database and identity routing

| Path | Configured database | Result |
| --- | --- | --- |
| Public frontend to the legacy Render API | Render Postgres, resource `MeFit`, as declared by the legacy API's deployed commit `c6d04bb` | Existing profiles read through this route, and successful application-account and profile writes through this API, use the legacy store. |
| Candidate Supabase API | Production MeFit Supabase project `rhvzbhlnoimvkzpyrgyn`, enforced by its session-pooler startup check | After cutover, new application accounts, linked-account reads, and profile writes through this API use Supabase Postgres. |
| Public signup (identity only) | Production MeFit Supabase Auth | Creates a sign-in identity separately from the MeFit application record. A successful signup or email confirmation is not evidence that the legacy API created an application account. |
| Staging | Separate Supabase project `vudfodfzvzsjhnjbyzch` | Keep staging identities, records, SMTP and callback configuration separate throughout. |

The production Supabase database already has application tables and records. The completeness and freshness of those records relative to Render Postgres have not been established. The legacy service's managed Blueprint and deployed source declare Render Postgres. Confirm the active Render environment's masked connection target independently with an authorized operator before migration, since a dashboard override can differ from source.

## Rollback compatibility design

Use one authoritative application database for both the candidate API and a rollback-compatible release of the API at the existing legacy URL. Keep the Keycloak realm and its own database intact. The rollback-compatible API must accept both configured production issuers, apply the appropriate issuer, audience, and MFA checks, and resolve linked identities to the same MeFit account. The preserved Vercel deployment already uses Supabase authentication and routes API requests to the legacy URL. Unmodified Keycloak-only API code cannot serve Supabase-only registrations merely by copying database rows.

Before opening writes, reconcile Render Postgres into Supabase using a reviewed import keyed by existing stable IDs. Compare users, roles, profiles, addresses, and dependent data. Resolve mismatches explicitly. Pause writes, copy the final delta, and verify equality of in-scope records before making the canonical database available to both routes. Disable application writes to the old database and retain a verified backup. This avoids divergent writes and preserves new registrations and profile changes through a frontend rollback. Prepare and test the dual-issuer release independently. It is a rollout requirement, separate from the account-linking implementation.

Rehearse with a legacy account with a profile and a newly registered Supabase-only account on disposable infrastructure. Save a distinct profile value for each through the candidate API. Restore the prior frontend route and retrieve both profiles through the compatibility API using the intended sign-in. Verify account/profile IDs and latest field values, then save an update through the rollback route and read it through the candidate route. A prior single-database Keycloak test verifies identity preservation, not this dual-issuer rollback rehearsal.

## Deployment order after review and approvals

1. Identify the active database hosts, migration histories, current service versions, recovery objectives, permitted downtime, and owner for each deployment. Do not rely on the legacy database as backup storage for future Supabase writes.
2. Before any data action, take encrypted, access-controlled backups of both application stores and document the Keycloak realm recovery procedure. Check provider backup availability. Where managed backups are unavailable, use approved logical exports with credentials supplied through protected local configuration. Verify each backup by restoring into a separate restricted environment and checking schema, relationship integrity, and representative records. Never restore a dump over a live database as a release rollback.
3. On isolated infrastructure, run the reviewed SQL, exercise the full browser flow with dedicated test accounts, and rehearse the canonical database migration and rollback. Include browser email verification, MFA, current Keycloak authorization, successful and mismatched links, profile creation and updates, and both account types through rollback.
4. After explicit migration approval, apply only the reviewed additive migration to production Supabase using the audited migration mechanism. Verify the table, primary key, unique index, foreign key, and RLS. Under the approved write-pause plan, reconcile data and confirm the canonical target. Keep all public routing unchanged while checking readiness and authenticated flows.
5. Configure the protected frontend with the candidate API and production Supabase publishable settings. Confirm the Supabase signup template and allowlisted confirmation callback, MFA and SMTP. Configure Keycloak `mefit-web` to allow the exact protected frontend `/auth/link/callback` and its web origin, with authorization code and PKCE S256. Verify its access token includes the stable subject from the Keycloak `basic` scope and the `mefit-api` audience. Use the corresponding production callback and origin only at the approved release step. Keep secrets in the API environment and require verified PostgreSQL TLS. Confirm the API Supabase JWT issuer and JWKS URL, plus the legacy Keycloak issuer and audience.
6. Check that the current legacy URL serves the verified compatibility API and can use the canonical database before enabling public writes. Keep its previous deployment available for infrastructure recovery. After separate cutover approval, promote the verified frontend and run the dedicated post-cutover authentication and profile tests.

## Verification evidence

The local browser test used dedicated synthetic accounts, real Keycloak 26.3, the candidate API, disposable PostgreSQL, and a fixture for Supabase Auth and email delivery. The existing account completed MFA, linked through Keycloak, and read its original profile through the new and legacy API code. The profile, account, roles and address remained identical after linking. A second account registered and confirmed in a separate browser context, completed MFA, saved and updated its profile, then signed in again. The database contained the updated profile. The 25 API and 29 frontend automated tests also passed.

The live Vercel deployment is ready and still serves the public alias. Its served frontend bundle references production Supabase, while the live legacy backend source validates Keycloak tokens. Authenticated access through the live Vercel deployment has not passed verification. Hosted email delivery, protected deployment testing, and the shared-database and dual-issuer rollback rehearsal remain open.

## Rollback procedure

If the candidate frontend fails after cutover, use Vercel Instant Rollback to restore deployment `dpl_GLV2sU7CcCmnX4GZJivvqUZuq2cq`. Keep the rollback-compatible API at the legacy URL, the canonical database, the identity-link table, and both issuers operating. Verify both test account types and the latest profile updates. Hold writes and escalate if the canonical database or compatibility API is unavailable. Restoring the original Keycloak-only service against its old database after accepting Supabase writes would require a separate, verified reconciliation and identity recovery plan.

References: [Render PostgreSQL recovery and backups](https://render.com/docs/postgresql-backups), [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback).
