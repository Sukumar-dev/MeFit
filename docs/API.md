# MeFit REST API candidate

The namespace below is deployed on an SRS preview. The existing public Render API is a separate contract.

Send a Supabase AAL2 bearer token on protected routes. Send JSON on writes. Search list routes accept only `search`.

| Method | Route | Minimum role | Inputs | Effect |
| --- | --- | --- | --- | --- |
| GET | `/fitness-api/health` | public | None | Read resource |
| GET | `/fitness-api/user` | user | None | Read resource |
| POST | `/fitness-api/user` | user | None | Create or execute resource action |
| GET | `/fitness-api/user/{id}` | user | id | Read resource |
| PATCH | `/fitness-api/user/{id}` | user | id, JSON | Update resource |
| DELETE | `/fitness-api/user/{id}` | user | id | Remove or archive per resource policy |
| POST | `/fitness-api/user/{id}/update_password` | user | id, JSON | Create or execute resource action |
| GET | `/fitness-api/profile` | user | None | Read resource |
| POST | `/fitness-api/profile` | user | JSON | Create or execute resource action |
| PUT | `/fitness-api/profile` | user | JSON | Update resource |
| PATCH | `/fitness-api/profile` | user | JSON | Update resource |
| DELETE | `/fitness-api/profile` | user | None | Remove or archive per resource policy |
| GET | `/fitness-api/goal` | user | None | Read resource |
| GET | `/fitness-api/goal/current` | user | None | Read resource |
| GET | `/fitness-api/goal/{id}` | user | id | Read resource |
| POST | `/fitness-api/goal` | user | JSON | Create or execute resource action |
| PATCH | `/fitness-api/goal/{id}` | user | id, JSON | Update resource |
| DELETE | `/fitness-api/goal/{id}` | user | id | Remove or archive per resource policy |
| PATCH | `/fitness-api/goal/{id}/status` | user | id, JSON | Update resource |
| POST | `/fitness-api/goal/{id}/workouts/{workout}/complete` | user | id, workout | Create or execute resource action |
| GET | `/fitness-api/program` | user | search | Read resource |
| GET | `/fitness-api/programs` | user | search | Read resource |
| GET | `/fitness-api/program/{id}` | user | id | Read resource |
| POST | `/fitness-api/program` | contributor | JSON | Create or execute resource action |
| PATCH | `/fitness-api/program/{id}` | contributor | id, JSON | Update resource |
| DELETE | `/fitness-api/program/{id}` | contributor | id | Remove or archive per resource policy |
| GET | `/fitness-api/workout` | user | search | Read resource |
| GET | `/fitness-api/workouts` | user | search | Read resource |
| GET | `/fitness-api/workout/{id}` | user | id | Read resource |
| POST | `/fitness-api/workout` | contributor | JSON | Create or execute resource action |
| PATCH | `/fitness-api/workout/{id}` | contributor | id, JSON | Update resource |
| DELETE | `/fitness-api/workout/{id}` | contributor | id | Remove or archive per resource policy |
| GET | `/fitness-api/exercises` | user | search | Read resource |
| GET | `/fitness-api/exercises/{id}` | user | id | Read resource |
| POST | `/fitness-api/exercise` | contributor | JSON | Create or execute resource action |
| PATCH | `/fitness-api/exercise/{id}` | contributor | id, JSON | Update resource |
| DELETE | `/fitness-api/exercise/{id}` | contributor | id | Remove or archive per resource policy |
| GET | `/fitness-api/contributor/content` | contributor | None | Read resource |
| POST | `/fitness-api/contributor-request` | user | JSON | Create or execute resource action |
| GET | `/fitness-api/contributor-request` | user | None | Read resource |
| GET | `/fitness-api/admin/contributor-requests` | admin | None | Read resource |
| PATCH | `/fitness-api/admin/contributor-requests/{id}` | admin | id, JSON | Update resource |
| GET | `/fitness-api/admin/users` | admin | None | Read resource |
| PATCH | `/fitness-api/admin/user/{id}/roles` | admin | id, JSON | Update resource |

Successful writes return 200, 201 with Location, or 204 depending on the route. GET /user redirects with 303. Invalid input returns 400, missing or invalid credentials 401, denied authorization 403, unknown targets 404, and unexpected server errors 500.

Field-level payload examples and hosted role evidence remain incomplete. See the existing route reference and audit matrix.

- [Existing API reference](API_DOCUMENTATION.md)
- [SRS compliance audit](SRS_COMPLIANCE.md)
- [OpenAPI candidate](openapi.yaml)
