# MeFit API reference

API base URL is `http://localhost:4000/api` in local development. All request/response bodies use JSON. Authenticated endpoints require `Authorization: Bearer <OIDC access token>`; the token must have the MeFit API audience. Except for catalog search, endpoints reject query parameters. Invalid or out-of-range bodies return `400`; unauthenticated requests return `401`; insufficient permission returns `403`; missing resources return `404`; state conflicts return `409`; rate limits return `429`.

## Authentication and users

| Method and path | Access | Purpose / body |
|---|---|---|
| `POST /login` | Public, 20/minute per source | `{ redirect_uri, state, nonce, code_challenge, flow?: "login"|"register" }`; returns `{ authorization_url }`. Passwords are handled by Keycloak. |
| `POST /user` | User | Provision/synchronize signed-in identity; returns `{ id, email, display_name, roles, has_profile }`. New rows return `201` and `Location`; existing rows return `200`. |
| `GET /user` | User | `303` redirect to the current user resource. |
| `GET /user/:user_id` | Self/admin | User summary and profile completion state. |
| `PATCH /user/:user_id` | Self/admin | `{ display_name }`; password fields are rejected. |
| `DELETE /user/:user_id` | Self/admin | Soft-disable account and audit the action; `204`. History is retained. |
| `POST /user/:user_id/update_password` | Self/admin | `303` redirect to Keycloak account password settings. App API never accepts/stores a password. |
| `GET /admin/users` | Admin | List account summaries, local roles, profile fitness-level label and disabled state. |
| `PATCH /admin/user/:user_id/roles` | Admin | `{ roles: ["USER", "CONTRIBUTOR", "ADMIN"] }`; audits role assignment. USER is always retained. |

## Profiles and contributor applications

| Method and path | Access | Purpose / body |
|---|---|---|
| `GET /profile` | User | Read own profile, readiness inputs, evaluation version, and optional address. |
| `PUT /profile` | User | Upsert profile. Body: `timezone`, optional `height_cm`, `weight_kg`, `activity_level`, `fitness_experience`, required `readiness` (`days_available`, `minutes_per_session`, `activity_level`, `experience`, `limitations`), optional `address`. Returns versioned score/level and suitability warning. |
| `POST /contributor-request` | User | `{ message? }`; creates one pending request or returns the existing pending request. |
| `GET /contributor-request` | User | List own requests and review state. |
| `GET /admin/contributor-requests` | Admin | List pending applications. |
| `PATCH /admin/contributor-requests/:request_id` | Admin | `{ status: "APPROVED"|"REJECTED" }`; a repeated review returns `409`; approval grants the local CONTRIBUTOR role. |

## Fitness catalog

| Method and path | Access | Purpose / body |
|---|---|---|
| `GET /exercises[?search=text]` | Public | Groups active exercises by target muscle group. `search` matches name/description. |
| `GET /exercises/:exercise_id` | Public | Exercise detail. |
| `GET /workouts[?search=text]` | Public | Groups active workouts by type. |
| `GET /workout/:workout_id` | Public | Workout detail with ordered exercises and set prescriptions. |
| `GET /programs[?search=text]` | Public | Groups active programs by category. |
| `GET /program/:program_id` | Public | Program detail with ordered workout summary. |
| `GET /contributor/content` | Contributor/admin | List content authored by the current contributor. |
| `POST /exercise` | Contributor/admin | `{ name, description, target_muscle_group, image_url?, video_url? }`; optional media URLs must be HTTPS. |
| `PATCH /exercise/:id`, `DELETE /exercise/:id` | Owner contributor/admin | Full validated update or soft archive. |
| `POST /workout` | Contributor/admin | `{ name, type, description, exercises: [{ exercise_id, position, sets: [{ repetitions?, duration_seconds?, rest_seconds?, load_kg? }] }] }`. |
| `PATCH /workout/:id`, `DELETE /workout/:id` | Owner contributor/admin | Replace workout prescription transactionally or soft archive. |
| `POST /program` | Contributor/admin | `{ name, category, description, workout_ids }`. |
| `PATCH /program/:id`, `DELETE /program/:id` | Owner contributor/admin | Replace ordered workout list or soft archive. |

Created catalog resources return `201` and `Location`. Edits to another contributor's item return `403`; referenced items are archived rather than hard-deleted.

## Goals and progress

| Method and path | Access | Purpose / body |
|---|---|---|
| `GET /goal/current` | User | Local current date, active goal, seven-day progress, workout assignments and completion timestamps. |
| `GET /goal` | User | Goal history and completion counts. |
| `POST /goal` | User with profile | `{ start_date, end_date, timezone, program_id?, workout_ids?, custom_workouts? }`; period is 1–7 days, timezone must be IANA, at least one item is required, and active periods cannot overlap. Returns `201`, `Location`, total and suitability warning. |
| `GET /goal/:goal_id` | Owner/admin | Goal detail with immutable prescription snapshots and completion state. |
| `POST /goal/:goal_id/workouts/:goal_workout_id/complete` | Goal owner | Mark assignment complete. Idempotent for repeats; completing the last assignment completes the goal. |

## Health

| Method and path | Access | Purpose |
|---|---|---|
| `GET /health` | Public | Process liveness. |
| `GET /ready` | Public | PostgreSQL readiness; `503` if the database query fails. |

The same application routes are mounted both at `/api/...` and root paths for SRS compatibility. Public deployment must replace local origins, use HTTPS, configure secret storage, and expose only the API base path through a reverse proxy.
