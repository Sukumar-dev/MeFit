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
3. Apply/verify schema and migration state.
4. Run API health and representative read checks against restored data.
5. Record backup timestamp, restore duration, and result.

The scripts are implemented, but a scheduled backup, configured durable destination, and restore drill are still pending. Until those are completed, local backup capability is not treated as an operational production backup service.
