# Render trial deployment

`render.yaml` defines three free web services in Virginia and reuses the existing Render Postgres database named `MeFit`:

- `mefit-web-sukumar`: React/Vite app served by Nginx
- `mefit-api-sukumar`: API; deploys Prisma migrations on startup. Seed the exercise/workout/program catalog once when provisioning a new database (`npm run db:seed`); do not reseed on each process restart.
- `mefit-auth-sukumar`: Keycloak 26.8.2 with the hosted `mefit` realm, exact web callback/origin, PKCE S256, API audience, and TOTP enrollment

For this temporary free trial, the API and Keycloak share the same logical database and Render-managed database credential. This avoids manual SQL setup. Before production, move Keycloak to its own database and role.

This is a trial deployment, not production hosting. Render's Free Postgres has a 1 GB limit, no backups, and expires 30 days after creation. Free web services sleep after 15 idle minutes, can take about a minute to wake, and cannot send SMTP traffic over ports 25, 465, or 587. Free services also have a 512 MiB memory limit; the Keycloak service was repeatedly OOM-killed at that limit. Keep production data off this database and export anything needed before it expires. See [Render's free plan limits](https://render.com/docs/free).

## Before applying the Blueprint

Create a fresh default credential before applying the Blueprint:

1. Open the `MeFit` Postgres service in Render and select **Info**.
2. Under **Credentials**, choose **+ New default credential**. Use a new name and save the generated credential in a password manager.
3. Delete the previous default credential from the same Credentials section. There are no MeFit services deployed yet; if your local `.env` uses the previous URL, update it privately after rotation.
4. In **Connect**, copy the **External** connection URL for the SQL setup below. Use the **Internal** URL only for the deployed services.

After rotating the credential, remove `0.0.0.0/0` from the database's external IP allow list if you do not need external database clients. The Blueprint uses Render's database references for the internal host, port, username, and password, so no database URL or password needs to be pasted into chat or Git. Render services in the same workspace and region continue to connect through the internal network.

## Blueprint environment values

The Blueprint obtains the MeFit API and Keycloak database settings from the existing `MeFit` database using Render's `fromDatabase` references. Since no email provider is configured, email verification is disabled for this trial so new users can register. Password-reset emails are unavailable until an email sender is configured. Before using real accounts, configure a supported email sender and turn email verification back on in the Keycloak realm.

The Keycloak bootstrap admin username is `mefit-admin`; Render generates its password. Retrieve it from the Keycloak service's **Environment** page and store it privately. The realm import contains no users and requires TOTP enrollment.

## Deploy and verify

After rotating credentials, create the Blueprint from `https://github.com/Sukumar-dev/MeFit`, branch `main`, file `render.yaml`, in the `sukumar's workspace` workspace. Review the trial deployment plan and apply it. The Keycloak realm must be imported once into the persistent database when creating a new environment; routine restarts now start Keycloak directly without re-importing it. The API applies migrations on startup; seed a new database once with `npm run db:seed`. The seed creates or updates only the versioned exercise/workout/program catalog and does not create demo users or goals.

Expected public URLs:

- Web: `https://mefit-web-sukumar.onrender.com`
- API: `https://mefit-api-sukumar.onrender.com/health` and `/ready`
- Keycloak discovery: `https://mefit-auth-sukumar.onrender.com/realms/mefit/.well-known/openid-configuration`

Check the API `/health` endpoint for process health and `/ready` for PostgreSQL connectivity. Render checks Keycloak's public OIDC discovery endpoint before considering the service ready. Check service logs and confirm no OOM restart events. Register a test account, complete TOTP enrollment, sign in, exercise profile/goals/library flows, and verify the rendered browser UI. Free web services sleep when idle, so the first request can be slow. Reliable 24/7 production service requires paid always-on compute; keep all three web services on paid compute to avoid both sleep delays and the Keycloak 512 MiB limit. The current trial deployment cannot promise always-on availability.
