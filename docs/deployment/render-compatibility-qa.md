# Isolated Render compatibility QA

Use this runbook only for new QA resources. The proposed names are `mefit-compatibility-qa-sukumar` for the service and `mefit-compatibility-qa-db` for the Render PostgreSQL resource. The expected service URL is `https://mefit-compatibility-qa-sukumar.onrender.com`. It is reserved here as a configuration requirement, not an assigned or verified URL.

## Required operator approvals

**Before provisioning**, record the operator’s explicit approval of the target workspace and reviewed QA revision. Verify all five items in the Blueprint preview and settings:

- [ ] Exactly one new QA API service named `mefit-compatibility-qa-sukumar`.
- [ ] Exactly one new disposable QA PostgreSQL resource named `mefit-compatibility-qa-db`.
- [ ] Zero updates to existing resources, with no inherited environment groups or existing database bindings.
- [ ] Only dedicated QA provider settings and credentials.
- [ ] Migration initially blocked by `QA_EXPECTED_DATABASE_HOST=dpg-unverified-qa`, which must differ from the generated internal hostname.

**Before enabling migration**, obtain explicit operator approval of the new QA database resource, its independently verified internal hostname, the web service’s managed binding, and the reviewed startup command. Only then update the pin and redeploy the new QA service.

**Before any hosted verification**, including readiness probes, obtain explicit operator approval for the verified QA API URL, QA frontend origin, dedicated providers, disposable database, test identities, and the scope of the tests. Record the approval with the build revision. Approval to provision or enable migrations does not authorize hosted verification.

## Provision and deploy (future approved work only)

1. In Render, verify that neither name exists. Use a separate workspace if the existing workspace has already used its single active free Postgres slot. Do not select a paid plan without cost approval. Keep the API and disposable database in Virginia. Before confirming creation, the Blueprint preview must show exactly one new web service and one new database and no updates to existing resources.
2. Create or identify a dedicated Supabase project for this QA environment and a QA-only Keycloak realm at `/realms/mefit-compatibility-qa`. The production and existing staging Supabase projects are excluded. Configure the QA Supabase signup callback and SMTP with a controlled test inbox, enable TOTP and asymmetric JWT signing, and use that project's publishable key. Configure a Keycloak public QA client with the exact QA frontend callback and web origin, authorization code with PKCE S256, the stable subject mapper, and an access-token audience mapper for `mefit-compatibility-qa`. Keep existing Keycloak realms unchanged. Select an isolated HTTPS frontend origin before creating the Blueprint.
3. Review the compatibility API changes and the QA files. Commit and push only those changes to a new branch such as `codex/render-compatibility-qa` after checking the branch is not associated with a production deployment. In Render choose **New → Blueprint**, select the QA branch and set **Blueprint Path** to `render.compatibility-qa.yaml`. Enter the QA issuer, Supabase project URL, publishable key and frontend origin in the prompts. Enter `dpg-unverified-qa` as the initial `QA_EXPECTED_DATABASE_HOST`. This deliberately keeps the first startup blocked. Leave `QA_DISPOSABLE_DATABASE_URL` managed by the Blueprint. After creation, open the **new** database's Info page, confirm the resource is `mefit-compatibility-qa-db` in Virginia, and copy only its internal hostname. Confirm the new web service has the expected URL and the intended database binding. Set `QA_EXPECTED_DATABASE_HOST` on that web service to the independently verified hostname, then save and redeploy only that service.
4. Record the deployed commit and Render status. The startup script validates the environment and then runs Prisma migrations from the QA service using the new Render database binding. Verify the migration log lists `20261122150000_add_supabase_identity_links`, then, after hosted verification approval, verify `GET /ready` returns 200 and unauthenticated `GET /api/profile` returns 401. Do not paste tokens or environment values into logs or chat.
5. In the isolated frontend build set `VITE_AUTH_PROVIDER=supabase`, the QA `VITE_SUPABASE_URL` and publishable key, `VITE_OIDC_AUTHORITY` and the QA `VITE_OIDC_CLIENT_ID`, and `VITE_API_URL` to the new Render service plus `/api`. Keep this frontend behind QA access controls. Do not promote it on Vercel or add a public domain.

## Hosted verification

Use dedicated test accounts and a controlled inbox. First establish an existing application account with a QA Keycloak token using `POST /api/user`, then save a profile using `PUT /api/profile`. Register a Supabase account with the matching QA email and use the linking screen after confirmation and MFA. Compare the profile IDs and role assignments across both identities. Use a separate verified Supabase-only account and a fresh signup to exercise account creation, profile reads and writes, page reload, logout and fresh sign-in. Reopen the same database through a second QA frontend build to verify rollback behavior. Confirm a regular user cannot open admin routes. Verify missing, expired and wrong-audience credentials and pre-MFA Supabase tokens are rejected, and check that retrying the same link preserves one mapping while conflicting links are rejected. Record observations and status codes without exposing tokens or test email links.

Hosted verification requires the dedicated providers and a verified Render resource-creation path. Local configuration tests cannot establish hosted results.


## Operator prerequisite checklist

- **Render owner:** Confirm the intended workspace has no active Free Render Postgres resource, both QA resource names are unused, the repository is connected, the owner can create Blueprints, and the exact expected service hostname is available. The free database has 1 GB, expires after 30 days, and has no managed backups. Use a separate approved workspace if the slot is occupied. Do not repurpose an existing resource or select a paid plan without approval.
- **Supabase QA:** Set `SUPABASE_URL` to the dedicated project origin and `SUPABASE_PUBLISHABLE_KEY` to that same project's `sb_publishable_` key. Verify the project reference in the dashboard. Leave `SUPABASE_JWT_ISSUER` and `SUPABASE_JWKS_URL` unset so the API derives `<SUPABASE_URL>/auth/v1` and its `/.well-known/jwks.json` endpoint. Verify an asymmetric ES256 or RS256 signing key is published, the access-token audience is `authenticated`, and a TOTP-verified session reaches `aal2`. Enable email/password registration and confirmation, configure QA SMTP and a controlled inbox, and allow the exact QA frontend callback. Use the signup template link `{{ .RedirectTo }}#token_hash={{ .TokenHash }}` for cross-device QA; preserve the separate password-reset callback if testing recovery.
- **Keycloak QA:** Set `OIDC_ISSUER` to the dedicated HTTPS realm origin plus `/realms/mefit-compatibility-qa`. Verify discovery returns that exact issuer and the realm certificates endpoint publishes the active signing key. Use a dedicated public QA frontend client with authorization code and PKCE S256, implicit and password grants off, exact `<WEB_ORIGIN>/auth/link/callback` redirect and exact web origin. Give the client the `basic` subject mapper and assign the client scope named `mefit-api-audience` requested by the linking frontend. That scope must map the **QA API audience** `mefit-compatibility-qa` into access tokens. Verify Keycloak access tokens have a stable `sub`, email claim and expiration.
- **Database gate:** Keep the generated internal binding, independently pin the new database's internal hostname, and preserve the Blueprint's QA startup command. Do not set PostgreSQL `PG*` overrides or inherit environment groups. The startup checker validates the inputs it sees. It does not establish workspace ownership or prove a publishable key belongs to the stated project; the operator checks those facts in the provider dashboards.

## Commands for a later authorized deployment

Run local validation from the repository root. The Render CLI needs access to the intended workspace for conflict checks.

```sh
git status --short
git diff --check
sh -n apps/api/scripts/start-compatibility-qa.sh
node --test apps/api/scripts/check-compatibility-qa.test.mjs
render blueprints validate ./render.compatibility-qa.yaml --workspace <qa-workspace-id>
```

After authorization to publish, push the reviewed QA-only branch and use the Dashboard Blueprint procedure above. Once the QA hostname is verified, the service is deployed, and hosted verification is explicitly approved, run the following without credentials.

```sh
curl -fsS --max-time 90 https://mefit-compatibility-qa-sukumar.onrender.com/ready
curl -sS --max-time 90 -o /dev/null -w '%{http_code}\n' https://mefit-compatibility-qa-sukumar.onrender.com/api/profile
```

Expect ready JSON and HTTP 401 respectively. Those checks do not replace the hosted authentication and rollback scenarios.

## Expected Blueprint preview for approval

This is the expected change set derived from the local Blueprint. The workspace owner must compare it with the actual Render preview before granting provisioning approval.

| Preview action | Resource | Expected settings |
| --- | --- | --- |
| Create one web service | `mefit-compatibility-qa-sukumar` | Virginia, Free, Docker, automatic deploys off, `/ready` health check, expected origin `https://mefit-compatibility-qa-sukumar.onrender.com` |
| Create one PostgreSQL database | `mefit-compatibility-qa-db` | Virginia, Free, database and role `mefit_compatibility_qa`, external IP allow list empty |
| Update or delete existing resources | Zero | No Vercel, DNS, routing, production, or staging changes |

The only database binding must be `QA_DISPOSABLE_DATABASE_URL` generated from the new database resource. The initial hostname pin is `dpg-unverified-qa`. Supply only the confirmed QA provider settings and QA frontend origin. Stop if the actual Render preview differs. Approval to provision does not approve either migration or hosted verification.

## Local browser evidence and remaining coverage

- Latest frontend suite: 33 passing tests. The API baseline is 25 passing tests, including rejection of expired tokens. The 18 startup isolation tests passed on this revision. The configured frontend build succeeded.
- Isolated Chromium verified dashboard navigation at 390, 768 and 1280 px, custom-workout goal creation, workout completion after reload, and catalog search and details. It also verified unauthorized administration and contributor requests, administrator account and request screens, role changes refreshing in the dashboard after reload, and administrator creation, editing and archival of an exercise. The archive confirmation was explicitly accepted in the local fixture.
- Local Supabase sign-out returned the user to login when remote revocation failed after the SDK had already cleared the browser session. A regression test asserts that sign-out reports failure when the provider session remains active. Restored sessions use the API's account ID, roles and profile status. The browser flow also verified fresh sign-in and rollback profile retrieval against the same disposable database.
- Supabase signup, email and MFA were simulated in the browser fixture. The expanded local run passed admin approval, rejection and role-save persistence, workout and program creation and program listing after reload, and reauthentication with profile restoration after a simulated expired Supabase session and rejected refresh. Both providers' correctly signed but expired fixture tokens were rejected by the API. The browser run recorded no uncaught page errors and only the intentional failure responses from the linking, authorization, logout and refresh scenarios. Chromium viewport checks are not a real-device or accessibility audit. Hosted email and MFA, genuine provider session expiry in a browser, every remaining control and accessibility coverage, and hosted rollback remain outstanding. No hosted QA verification has been authorized or performed.


Concurrent approval and rejection of one request are now guarded by a conditional update inside the review transaction. The disposable PostgreSQL regression verifies one decision succeeds, the other returns HTTP 409, and the persisted contributor role agrees with the winning decision.

## Real-device and authentication recovery plan

Run these checks only after explicit hosted-verification approval. Use synthetic QA users and an inbox controlled by the operator. Record device, OS, browser, viewport, expected outcome and observed outcome. Do not capture credentials, verification links, QR codes, setup keys or tokens in the results.

- **Real devices:** Test iOS Safari and Android Chrome on phones in portrait and landscape, and Safari or Chrome on a tablet. Include registration, opening confirmation on a different device, MFA, the Keycloak link and return, profile edit and save, dashboard links, catalog detail, goal and workout controls, logout and sign-in. Check zoom, rotation, the on-screen keyboard, focus visibility, horizontal overflow, and whether sticky or fixed content covers a control.
- **Keyboard and assistive technology:** Run Tab and Shift+Tab through full forms and admin and contributor actions. Open and close available dialogs with the keyboard and verify focus returns to the launching control. Use VoiceOver or TalkBack to verify names, loading and error announcements, MFA entry, and success messages. Include contrast and keyboard testing at 200% zoom. A Chromium accessibility-tree name scan is only one part of this review.
- **Provider recovery:** With QA-only settings, let a genuine access token expire with a valid refresh path and confirm reload restores the same account, roles and profile. Then expire or revoke the QA provider session and verify protected routes return to login and a fresh MFA sign-in restores persisted data. Repeat for both identity providers with their intended session policies. Simulate a transient logout failure and verify retry if the provider session remains. Repeat across the QA rollback frontend and confirm both account types can retrieve recent writes through the same QA database.

## Frozen-revision accessibility and layout review

Local Chromium exposed accessible names for all 183 interactive nodes sampled across 11 rendered states, including sign-in, registration, linking, profile setup, dashboard, goals and its editor, catalog and its detail panel, admin, and contributor. Keyboard Tab reached the visibly focused sign-in email field, then password. Layout checks at 320, 390, 768 and 1280 px found one horizontal overflow at 320 px in the contributor workspace's three-button authoring selector. The two targeted local runs covered the core account, planner, privileged, and rollback workflows. The application and deployment configuration were left frozen; the 320 px issue, exhaustive control traversal, screen-reader operation and contrast checks remain open.

## Six-width responsive follow-up

The earlier 320 px overflow reproduced on the contributor authoring selector. Its single-line inline flex container exceeded the available width. The selector now wraps within the container and exposes the active category with `aria-pressed`. The new Playwright regression verified that each of the three admin authoring category buttons fits in the viewport and activates with Enter at 320, 360, 375, 390, 768 and 1280 px.

The local Chromium workflow rerun found no document-level horizontal overflow at those widths across 11 sampled states. The accessibility tree exposed names for all 189 sampled controls. This is targeted evidence. Exhaustive keyboard and focus-order testing, screen-reader operation, contrast, text scaling, and coverage of every control and clipping condition remain open. No hosted service was provisioned or verified.
