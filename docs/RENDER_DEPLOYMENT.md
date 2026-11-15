# Render trial deployment

`render.yaml` defines three free web services in Virginia and reuses the existing Render Postgres database named `MeFit`:

- `mefit-web-sukumar`: React/Vite app served by Nginx
- `mefit-api-sukumar`: API; deploys Prisma migrations, then seeds the catalog once on its first successful deploy
- `mefit-auth-sukumar`: Keycloak 26.8.2 with the hosted `mefit` realm, exact web callback/origin, PKCE S256, API audience, TOTP enrollment, and email verification

For this temporary free trial, the API and Keycloak share the same logical database and Render-managed database credential. This avoids manual SQL setup. Before production, move Keycloak to its own database and role.

This is a trial deployment, not production hosting. Render's Free Postgres has a 1 GB limit, no backups, and expires 30 days after creation. Free web services sleep after 15 idle minutes, can take about a minute to wake, and cannot send SMTP traffic over ports 25, 465, or 587. Keep production data off this database and export anything needed before it expires. See [Render's free plan limits](https://render.com/docs/free).

## Before applying the Blueprint

Create a fresh default credential before applying the Blueprint:

1. Open the `MeFit` Postgres service in Render and select **Info**.
2. Under **Credentials**, choose **+ New default credential**. Use a new name and save the generated credential in a password manager.
3. Delete the previous default credential from the same Credentials section. There are no MeFit services deployed yet; if your local `.env` uses the previous URL, update it privately after rotation.
4. In **Connect**, copy the **External** connection URL for the SQL setup below. Use the **Internal** URL only for the deployed services.

After rotating the credential, remove `0.0.0.0/0` from the database's external IP allow list if you do not need external database clients. The Blueprint uses Render's database references for the internal host, port, username, and password, so no database URL or password needs to be pasted into chat or Git. Render services in the same workspace and region continue to connect through the internal network.

## Blueprint environment values

The Blueprint obtains the MeFit API's database connection from the existing `MeFit` database using Render's `fromDatabase` reference. For Keycloak, it uses the same instance's private host/port but a separate database and role. `sync: false` values should be entered in Render's protected service Environment pages (or the initial Blueprint approval screen), not in Git or chat:

| Service | Variable | Value to enter |
| --- | --- | --- |
| Keycloak | `MEFIT_SMTP_HOST` | Host supplied by your email provider |
| Keycloak | `MEFIT_SMTP_PORT` | SMTP port your provider supports from Render; avoid 25, 465, and 587 on Free services |
| Keycloak | `MEFIT_SMTP_FROM` | Verified sender address |
| Keycloak | `MEFIT_SMTP_USERNAME` | SMTP username |
| Keycloak | `MEFIT_SMTP_PASSWORD` | SMTP password or provider-specific credential |

The Keycloak bootstrap admin username is `mefit-admin`; Render generates its password. Retrieve it from the Keycloak service's **Environment** page and store it privately. The production realm import contains no users and requires email verification and TOTP enrollment. Do not enable public registration until valid SMTP delivery has been tested.

## Deploy and verify

After rotating credentials, create the Blueprint from `https://github.com/Sukumar-dev/MeFit`, branch `main`, file `render.yaml`, in the `sukumar's workspace` workspace. Review the free-only three-service plan and apply it. Configure the manual SMTP variables above in Render. The API runs the existing Prisma migrations at startup; its first successful deploy seeds only the versioned exercise/workout/program catalog. The seed is idempotent and does not create demo users or goals.

Expected public URLs:

- Web: `https://mefit-web-sukumar.onrender.com`
- API: `https://mefit-api-sukumar.onrender.com/health` and `/ready`
- Keycloak discovery: `https://mefit-auth-sukumar.onrender.com/realms/mefit/.well-known/openid-configuration`

Check the API `/health` endpoint for process health and `/ready` for PostgreSQL connectivity. Check Keycloak's discovery endpoint and Render service logs. Complete SMTP verification, register a real account, sign in, exercise profile/goals/library flows, and verify the rendered browser UI before calling the deployment ready. Free web services sleep when idle, so the first request can be slow.
