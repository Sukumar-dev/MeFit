# Security and Deployment Readiness

## Implemented controls

- OpenID Connect authorization code flow with PKCE; API validates RS256 signature, issuer, audience, subject, email, expiry, and role claims.
- Keycloak TOTP required action for local registration; API rate-limits sign-in bootstrap requests.
- Local role authorization, user/content ownership checks, account disable, and audit events for role, profile, and contributor-request changes.
- Zod request schemas, HTTPS-only optional profile/media URLs, Helmet headers, bounded JSON request size, CORS origin allowlist, and generic API 500 responses.
- PostgreSQL persistence with Prisma relations, migrations, and encrypted local backup/restore scripts.
- `.env` is ignored; `.env.example` contains only local placeholders.

## Required before a public deployment

1. Provision a production HTTPS web/API domain and configure reverse proxy, TLS, HSTS, CORS, callback/logout allowlists, and secure cookie policy.
2. Run a managed PostgreSQL service with private networking, encryption at rest, least-privilege credentials, migration process, connection limits, monitoring, and recovery objectives.
3. Configure a production Keycloak/OIDC realm: public web client with exact redirect URIs and PKCE S256; API audience; TOTP; verified email; password reset; brute-force protections; administrator lifecycle; key rotation and recovery procedures.
4. Replace every local credential and database URL with secrets from a managed secret store. Do not expose the local Keycloak bootstrap account.
5. Configure production email delivery and domain verification for account verification and password recovery.
6. Choose an object store/CDN and content validation policy for profile images and exercise media. Current app accepts HTTPS URLs and does not upload files.
7. Configure daily encrypted backups to an independent durable location, seven-day or longer retention, failure alerts, encryption key custody/rotation, and a scheduled restore drill.
8. Add API/frontend monitoring, centralized redacted logs, vulnerability scanning, dependency update policy, rate limits at the edge, incident response, and privacy/retention policy for health and address data.
9. Run an accessibility review, mobile device/viewport checks, load/performance checks, security review, clean install, migration test, and production smoke test.
10. Capture approved operator contacts, target availability, backup RPO/RTO, admin email, hosting provider, production origins, and release/rollback procedures.

## Current deployment state

Only local development has been configured and verified. No production domain, hosting account, email provider, media store, monitoring, production database, or remote backup destination was provided. This project is not publicly deployed or production-ready.
