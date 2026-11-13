# MeFit Database Schema

This document describes the implemented Prisma schema and PostgreSQL migration. Development migration `20261112140845_init` is applied locally.

## Entities

- **User**: UUID, unique OIDC subject, email, display name, account status, timestamps.
- **UserRole**: unique `(userId, role)` assignment; roles USER, CONTRIBUTOR, ADMIN. ADMIN implies contributor authorization.
- **Profile**: unique user relation; timezone, height/weight values with units, activity/experience, readiness answers/evaluation, optional HTTPS profile media reference, timestamps.
- **Address**: optional profile address components based on the supplied ERD; collect only if product confirms address is needed.
- **ContributorRequest**: requester, status, reviewer, reviewed time, optional reason, timestamps.
- **Exercise**: name, description, target muscle group, optional validated image/video URI, creator, archive flag, timestamps.
- **Workout**: name, type, description, creator, archive flag, timestamps.
- **WorkoutExercise**: ordered workout-to-exercise relation, unique order per workout.
- **ExerciseSet**: ordered prescription for a workout exercise, repetitions and optional duration/rest/load guidance; positive-value constraints.
- **Program**: name, category, description, creator, archive flag, timestamps.
- **ProgramWorkout**: ordered program-to-workout relation, unique order per program.
- **Goal**: owner, local start date, end date derived as start + 6 calendar days, timezone snapshot, status, optional source program, timestamps.
- **GoalWorkout**: goal assignment and immutable workout/exercise prescription snapshot, source catalog IDs where applicable, unique assignment identity.
- **WorkoutCompletion**: unique goal-workout assignment completion, completed time and completing user.
- **AuditLog**: actor, action, target type/ID, safe metadata, timestamp; excludes secrets and unnecessary health attributes.

## Integrity and indexes

UUID primary keys; foreign keys; unique email/subject/role and completion constraints; indexes on goal owner/status/date, catalog categories/types/muscle group, creator IDs and audit timestamp. Restrict deletion of referenced catalog records and preserve goal snapshots. User deletion follows a documented privacy-retention policy; credentials remain in Keycloak.

## Data protection

PostgreSQL is authoritative for application domain data. Enforce ownership and role checks in the API. Minimize sensitive profile data, do not expose health attributes in catalog/dashboard responses, and encrypt transport and backup storage in production.

## Schema verification

Prisma client generation, migration application, database seeding, readiness checks and persistence counts have passed against local PostgreSQL. A clean-environment migration and backup restore drill remain pending.
