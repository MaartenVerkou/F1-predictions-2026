## Why

Wheel of Knowledge currently stores application data in SQLite files inside the app state directory. The server is moving toward shared infrastructure for multiple production apps, so F1 should use a centrally managed PostgreSQL service with explicit backup, restore, and per-app isolation.

## What Changes

- Add a central PostgreSQL service under `/srv/infra/postgres` for production database hosting.
- Migrate the F1 application database from SQLite to a dedicated PostgreSQL database and user.
- Move F1 session storage from the SQLite session file to PostgreSQL-backed session storage.
- Add a migration path that copies existing SQLite production data into PostgreSQL before cutover.
- Update deployment configuration so F1 connects to PostgreSQL over an internal Docker network instead of reading `app.db`.
- Keep rollback viable by preserving the pre-migration SQLite files and deployment configuration until verification is complete.
- **BREAKING**: production F1 deployments require `DATABASE_URL` and the central PostgreSQL network after this change.

## Capabilities

### New Capabilities
- `central-postgres-storage`: Shared PostgreSQL infrastructure, per-app database isolation, and SQLite-to-Postgres migration behavior.

### Modified Capabilities
- `production-deployment`: F1 production deployment must depend on central PostgreSQL rather than SQLite state files.

## Impact

- Affected code: `server.js`, session storage, actuals snapshot helpers, admin/auth routes, actuals backfill scripts, tests, Docker Compose configuration, deployment scripts, and docs.
- Affected dependencies: replace or augment `better-sqlite3` with PostgreSQL client/session dependencies.
- Affected systems: production Docker networking, central infrastructure under `/srv/infra/postgres`, F1 production data migration, backups, and restore procedures.
