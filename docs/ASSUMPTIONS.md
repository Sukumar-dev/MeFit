# Assumptions and Open Decisions

These are explicit implementation assumptions, not additional client requirements. The SRS remains authoritative. Revisit any item if the client supplies a decision.

| Topic | Working assumption | Reason / impact |
|---|---|---|
| Stack | React/TypeScript/Vite + Node/Express/Prisma + PostgreSQL | Required by the later master brief; no existing application is present. |
| Identity | Keycloak OIDC Authorization Code + PKCE, bearer access tokens; app API never handles user passwords | Aligns with SRS recommendation and keeps credentials at the identity provider. |
| `POST /login` | Starts OIDC login/redirect; registration is provided through the identity-provider registration flow | SRS names the endpoint but gives no body schema; do not invent a local password exchange. |
| Password update | Identity provider account action; compatibility API route initiates/validates that action rather than persisting a password | SRS explicitly prohibits password updates through generic user PATCH. |
| MFA | TOTP required before protected app use | Master brief calls for enforced 2FA; SRS says it should be enforced. |
| Week period | Seven calendar days starting on user-selected local date, using profile timezone; default current local date | SRS permits a different start date but omits week boundary and timezone rules. |
| Overlapping goals | At most one active overlapping goal per user | Makes dashboard/current-goal semantics unambiguous. |
| Goal composition | May combine programs, existing workouts, and custom workouts | Required feature set allows each selection path. |
| Completion | One completion per goal-workout assignment; unique database constraint | Prevents duplicate completion and supports persistent progress. |
| Fitness evaluation | Configurable, transparent, self-reported readiness/activity rules; no medical diagnosis or claimed clinical thresholds | SRS provides no formula or medically validated limits. |
| Sensitive profile data | Private to user and authorized admins; collect only fields used for requested features | SRS includes health information but gives no privacy model. |
| Catalog edits/deletes | Goal assignments retain a snapshot; referenced catalog items are archived rather than hard-deleted | Preserves history and referential integrity. |
| Backups | Daily encrypted PostgreSQL logical backups, seven-day rotation, documented restore drill | Meets DB-02; destination/provider must be selected for production. |
| Media | Validate HTTPS media references and provide a configured upload store; never render broken remote media | SRS requests images/video links but does not define hosting. |

## Questions for a later client decision

- What constitutes a “week” for reporting: fixed Monday-Sunday or a rolling seven-day period?
- Should contributors see or edit content authored by other contributors?
- Which profile/evaluation questions and recommendation criteria should the client approve?
- Which production hosting, identity-provider tenant, email service, backup destination, and domain will be used?
- Should the application expose full user deletion, or retain de-identified audit/history records?
