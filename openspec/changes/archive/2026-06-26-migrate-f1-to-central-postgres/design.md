## Context

The production server now has a central edge stack under `/srv/edge/current`. F1 still stores application data in SQLite files mounted from `/var/lib/wheelofknowledge/state`, while Kinara already uses PostgreSQL in an app-local container. The next server-wide infrastructure step is a central PostgreSQL service that future apps can share through separate databases and users.

The F1 application currently uses `better-sqlite3` directly throughout `server.js`, `src/routes/*`, `src/actuals-snapshots.js`, session storage, tests, and actuals backfill scripts. Those calls are synchronous. The mainstream PostgreSQL client for Node (`pg`) is asynchronous, so a safe production cutover needs a deliberate adapter/refactor rather than a simple environment-variable change.

## Goals / Non-Goals

**Goals:**
- Create central PostgreSQL infrastructure in `/srv/infra/postgres` using a private Docker network.
- Give F1 a dedicated database, role, password, and connection string.
- Preserve existing F1 SQLite files until the PostgreSQL deployment is verified.
- Move app data and session data to PostgreSQL-backed storage for production.
- Keep local development/test fallback possible while the codebase is migrated.
- Verify production via `/healthz`, login rendering, and focused database-backed tests.

**Non-Goals:**
- Migrate Kinara or portfolio data in this change.
- Expose PostgreSQL publicly.
- Redesign F1 domain tables beyond PostgreSQL compatibility.
- Remove every legacy SQLite helper in one step if a compatibility fallback is still needed for tests.

## Decisions

### Central PostgreSQL lives under `/srv/infra/postgres`

The server will use one central PostgreSQL stack, matching the central edge pattern:

```text
/srv/infra/postgres/current/docker-compose.yml
/srv/infra/postgres/shared/.env
/srv/infra/postgres/backups
```

The stack owns the PostgreSQL container and a private Docker network such as `wok-db`. Apps join the network and connect by service DNS name. PostgreSQL does not publish host ports.

Alternative considered: keep one PostgreSQL container per app. That is simpler for isolated deployment, but it duplicates backup, monitoring, upgrade, and restore logic for every app.

### Use per-app databases and roles

F1 gets a dedicated database and role. Future apps follow the same pattern. This gives one operational service while preserving access isolation between apps.

Alternative considered: one shared schema/database for all apps. That makes cross-app mistakes easier and complicates app-level restore.

### Treat the SQLite-to-Postgres cutover as a data migration with rollback

Before cutover, take a server backup of:

- `/var/lib/wheelofknowledge/state`
- `/srv/f1-predictions/current/.env`
- current Docker Compose config

Then load SQLite data into the F1 PostgreSQL database, start F1 against PostgreSQL, and verify health/pages. Rollback is restoring the previous `.env`/compose values and restarting F1 against the preserved SQLite state.

Alternative considered: live dual-write from SQLite to PostgreSQL. That is unnecessary complexity for this small app and does not remove the need for a maintenance window.

### PostgreSQL client integration must respect existing synchronous call sites

Because the app uses synchronous `better-sqlite3` calls broadly, implementation must either:

- introduce a transitional database facade that preserves the current call shape while targeting PostgreSQL, or
- convert database-dependent routes/helpers to async/await in focused slices.

The safer long-term design is async/await with `pg`, but the blast radius is large. If a transitional facade is used for the first cutover, it must be documented as a migration bridge and covered by tests.

## Risks / Trade-offs

- [Risk] Production data loss during migration -> Mitigation: take SQLite and config backups before importing, verify row counts, and keep SQLite files untouched until after verification.
- [Risk] App starts against an empty PostgreSQL database -> Mitigation: migration script verifies expected table row counts before cutover.
- [Risk] PostgreSQL enforces constraints SQLite did not enforce -> Mitigation: run import in staging/temporary database first and fix any constraint violations before production cutover.
- [Risk] Large sync-to-async refactor introduces behavior regressions -> Mitigation: keep tests focused on public flows, run `/healthz`, auth/login, admin actuals, and leaderboard checks before deploy.
- [Risk] Central PostgreSQL becomes shared failure point -> Mitigation: centralize backups and keep per-app databases/users for isolation.

## Migration Plan

1. Add central PostgreSQL stack under `/srv/infra/postgres`.
2. Create F1 database/user and a private Docker network.
3. Add F1 app database configuration for `DATABASE_URL`.
4. Add migration tooling to create PostgreSQL schema and import existing SQLite rows.
5. Run migration against a fresh F1 PostgreSQL database and compare table row counts.
6. Stop only the F1 app container for cutover.
7. Update F1 `.env`/compose to use `DATABASE_URL`.
8. Start F1 and verify `/healthz`, `/login`, and a database-backed smoke path.
9. Keep SQLite state backup and previous config for rollback.

## Open Questions

- Whether to do the first production cutover with a compatibility facade or complete an async `pg` refactor before switching.
- Whether F1 sessions should live in the same F1 database or a separate `f1_sessions` schema. The default is same database unless operational needs say otherwise.
