# Database Backup and Restore

## Requirement

DB-02 requires a complete database backup at least once per day, retained for at least seven days.

## Local implementation

`scripts/backup-postgres.sh` creates a PostgreSQL custom-format dump inside the PostgreSQL container, encrypts it with OpenSSL AES-256-CBC/PBKDF2 using `BACKUP_ENCRYPTION_KEY`, writes a SHA-256 checksum, and removes encrypted local backups older than seven days. File permissions are private by default. Set `BACKUP_DIRECTORY` to an encrypted/durable volume for operations. The encryption key must be stored separately from backups.

For a local daily run at 02:00, add this line to `crontab -e`, replacing the path with this checkout's absolute path:

```cron
0 2 * * * BACKUP_DIRECTORY='/path/to/encrypted-backups' /path/to/mefit/scripts/backup-postgres.sh >> /path/to/mefit/backups/backup.log 2>&1
```

Keep `BACKUP_ENCRYPTION_KEY` in the ignored local `.env` for this local scheduler. In production, inject it from the scheduler's secret manager; do not place it in the crontab or backup volume.

Production should use a managed scheduler/secret store and copy encrypted backups to an independent storage account. Configure failure alerts, retention locks, access controls, and key rotation before production launch.

## Restore procedure

1. Create a new empty, isolated PostgreSQL database and select an encrypted backup.
2. Set `BACKUP_ENCRYPTION_KEY`, `RESTORE_DATABASE` to that new database name, and `RESTORE_CONFIRM=RESTORE_TO_NON_PRODUCTION`.
3. Run `scripts/restore-postgres.sh /path/to/mefit-YYYYMMDDTHHMMSSZ.dump.enc`; it verifies the checksum when the sidecar exists, decrypts the dump, and restores into the explicitly named target.
4. Apply/verify schema and migration state.
5. Run API health and representative read checks against restored data.
6. Record backup timestamp, restore duration, and result.

The scripts are implemented, but a scheduled backup, configured durable destination, and hosted restore drill are still pending. Until those are completed, local backup capability is not treated as an operational production backup service.

## Hosted GitHub Actions backup candidate

The [encrypted backup workflow](../.github/workflows/database-backup.yml) runs daily at 02:17 UTC after it reaches the default branch. It streams a PostgreSQL 17 custom-format dump into GPG encryption, validates that the encrypted stream contains a readable archive, and retains the encrypted artifact for eight days. The artifact never contains a plaintext dump. Repository visibility governs who can download artifacts.

Configure repository Actions secrets `MEFIT_BACKUP_DATABASE_URL` and `MEFIT_BACKUP_PASSPHRASE`, plus Actions variable `MEFIT_EXPECTED_PROJECT`. Use the intended Supabase direct or session-pooler URL with port 5432 and `sslmode=verify-full`. Keep the passphrase independently available for disaster recovery. Test the workflow with staging credentials on an isolated branch before enabling the production schedule. A successful Actions run and a retained artifact are required evidence.

### Restore drill

1. Download the archive and checksum from a successful run. Verify with `sha256sum -c *.sha256`.
2. Provision an isolated PostgreSQL 17 restore target. Ensure required Supabase roles, extensions and identity schemas exist if the dump expects them.
3. Decrypt with `gpg --output mefit.dump --decrypt mefit-<timestamp>.dump.gpg` and review `pg_restore --list mefit.dump`.
4. Restore to the isolated target using `pg_restore --exit-on-error --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" mefit.dump`. Recreate environment-specific privileges and verify them before exposing the restored service.
5. Compare row counts, inspect RLS, exercise profile and planner reads, and record the restore duration. Remove plaintext files from the restore environment when the drill ends.

This is a logical database backup. Storage objects, provider settings, and global roles require their own recovery procedures.
