# F1 PostgreSQL Operations

F1 production now uses the central PostgreSQL stack on `mhv-server`.

## Runtime Layout

- App path: `/srv/f1-predictions/current`
- App state backup source: `/var/lib/wheelofknowledge/state`
- Central PostgreSQL stack: `/srv/infra/postgres/current`
- Central PostgreSQL backups: `/srv/infra/postgres/backups`
- F1 app connects through the internal Docker network `mhv-db`.
- F1 remains reachable by central Caddy through `mhv-web` with alias `f1-app`.

The F1 database connection string is host-managed in `/srv/f1-predictions/current/.env` as `DATABASE_URL`.

Central PostgreSQL backup dumps are written under `/srv/infra/postgres/backups`.
The active host-level encrypted backup entrypoints are `/usr/local/sbin/mhv-backup`
and `/usr/local/sbin/mhv-backup-prune`.

## Migration Command

Run the SQLite import from the deployed app image so the script version matches production code:

```bash
cd /srv/f1-predictions/current
set -a
. /srv/infra/postgres/shared/.env
set +a
DATABASE_URL="$F1_DATABASE_URL" docker compose -f docker-compose.yml -f docker-compose.server.yml run --rm \
  -e DATABASE_URL="$F1_DATABASE_URL" \
  app node scripts/migrate-sqlite-to-postgres.js --sqlite=/app/state/app.db --reset
```

The command prints per-table SQLite and PostgreSQL row counts and exits non-zero when any count differs.

## Rollback

Keep the pre-migration tarball under `/root/migration-backups/` until the cutover is accepted.

To roll F1 back to SQLite:

```bash
cd /srv/f1-predictions/current
cp .env .env.postgres-rollback-copy
grep -v '^DATABASE_URL=' .env > /tmp/f1-env-without-database-url
install -m 600 /tmp/f1-env-without-database-url .env
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-deps --force-recreate app
```

If SQLite files also need to be restored, extract the pre-migration tarball for `/var/lib/wheelofknowledge/state` before recreating the app container.

After rollback or cutover, verify:

```bash
curl -fsS https://wheelofknowledge.com/healthz
curl -fsS https://wheelofknowledge.com/login >/dev/null
curl -fsS https://wheelofknowledge.com/global/leaderboard >/dev/null
```
