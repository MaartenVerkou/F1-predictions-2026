## 1. Central PostgreSQL Infrastructure

- [x] 1.1 Create `/srv/infra/postgres` stack with private Docker networking, persistent volume, and root/admin credentials stored outside app repos.
- [x] 1.2 Create F1-specific PostgreSQL database, role, password, and internal `DATABASE_URL`.
- [x] 1.3 Add backup/restore commands or documentation for the central PostgreSQL service.

## 2. Application PostgreSQL Support

- [x] 2.1 Add PostgreSQL client/session dependencies and a database module that can run F1 against PostgreSQL when `DATABASE_URL` is configured.
- [x] 2.2 Convert or adapt schema initialization, migrations, transactions, inserts, and health checks for PostgreSQL compatibility.
- [x] 2.3 Move production session storage to PostgreSQL when `DATABASE_URL` is configured while keeping local/test fallback viable.
- [x] 2.4 Update Docker Compose and deployment configuration so production can join the central database network and preserve `DATABASE_URL`.

## 3. Data Migration

- [x] 3.1 Add a SQLite-to-PostgreSQL migration script that creates compatible schema and imports all F1 application tables.
- [x] 3.2 Add row-count and smoke verification for migrated tables before cutover.
- [ ] 3.3 Back up the production SQLite state and current F1 configuration before running the production migration.

## 4. Verification and Cutover

- [x] 4.1 Run relevant local tests for health, auth/security flows, actuals snapshots, and leaderboard data behavior.
- [ ] 4.2 Run production migration into the central F1 PostgreSQL database and verify row counts.
- [ ] 4.3 Restart F1 against PostgreSQL and verify `/healthz`, `/login`, and a database-backed production route.
- [ ] 4.4 Document rollback steps and keep the pre-migration SQLite state/config until the cutover is accepted.
