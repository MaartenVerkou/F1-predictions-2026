## Context

The Hetzner host now runs multiple apps behind one Caddy edge stack and one central PostgreSQL stack. The shared pieces still use names inherited from Wheel of Knowledge:

- Docker networks: `wok-web`, `wok-db`
- Containers/projects: `wok-caddy`, `wok-postgres`, `wok-edge`, `wok-postgres`
- Backup cron and commands: `/etc/cron.d/wok-backup`, `/usr/local/sbin/wok-backup`

The product domain `wheelofknowledge.com` is still correct for the F1 app and should not be renamed. The goal is only to rename host-level shared infrastructure to the broader `mhv-*` platform naming used by `mhvmade.com`.

## Goals / Non-Goals

**Goals:**

- Make shared production infrastructure names app-neutral under the `mhv-*` prefix.
- Keep existing apps reachable during a controlled rolling migration.
- Schedule central PostgreSQL dump backups and make host-level backup entrypoints MHV-named.
- Preserve existing secrets, domains, data volumes, and app-specific state unless a rename is necessary for the central platform.

**Non-Goals:**

- Rename Wheel of Knowledge product domains, database names, tables, or app-specific state paths.
- Migrate Kinara from its current app-local PostgreSQL container to the central PostgreSQL service.
- Introduce a full monitoring/log aggregation platform in this change.
- Rotate secrets or change backup storage providers.

## Decisions

1. Use `mhv-web` and `mhv-db` as the shared Docker networks.

   These names describe the server/platform rather than an individual app. `mhv-db` remains an internal Docker network with no host-published PostgreSQL port. Existing app-specific internal networks such as `kinara-internal` remain app-owned.

2. Rename shared containers to `mhv-caddy` and `mhv-postgres`, but retain compatibility where needed during cutover.

   Container names are operational handles used by scripts and humans. The migration updates central scripts and compose files to the new names and leaves old data volumes available for rollback instead of deleting them.

3. Keep app-specific names when they represent real app identity.

   `wheelofknowledge.com`, `/var/lib/wheelofknowledge/state`, and the `f1_predictions` database remain valid because they describe the F1 app, not shared infrastructure.

4. Split database dump creation from encrypted remote backup storage.

   The central PostgreSQL stack owns dump creation under `/srv/infra/postgres/backups`. The host-level Restic job owns encrypted off-server backup and prune behavior. The MHV backup entrypoint can include central backup outputs without hard-coding app-specific SQLite assumptions.

## Risks / Trade-offs

- Brief routing downtime during network/container recreation -> Connect services to the new `mhv-web` network before switching Caddy where possible, then verify all public routes immediately.
- PostgreSQL connection breakage if app secrets still reference `wok-postgres` -> Update connection-string hostnames in host-managed env files without printing secret values, then recreate app containers.
- Duplicate backups if old and new cron files both run -> Install `mhv-backup` cron and archive or disable the old `wok-backup` cron after the new job is verified.
- Data risk during PostgreSQL container rename -> Take a fresh dump before the rename, preserve the old Docker volume for rollback, and verify `/healthz` reports PostgreSQL connectivity after restart.

## Migration Plan

1. Create and validate the OpenSpec proposal, design, specs, and tasks.
2. Update the repo production overlay and documentation from `wok-*` central names to `mhv-*` central names.
3. On the server, create `mhv-web` and `mhv-db`.
4. Update central edge and PostgreSQL compose files to `mhv-*` project/container/network names.
5. Update app compose files and host-managed database URLs to use `mhv-web`, `mhv-db`, and `mhv-postgres`.
6. Install MHV-named backup entrypoints and scheduled PostgreSQL dump automation.
7. Recreate central and app containers in a controlled order and verify public routes, app health, PostgreSQL health, and backup creation.

Rollback: restore the backed-up server compose/env files, reconnect/recreate containers against `wok-web` and `wok-db`, and use the preserved old PostgreSQL volume or latest dump if needed.

## Open Questions

- None for this change. Future work can decide whether Kinara should migrate from app-local PostgreSQL to the central PostgreSQL service.
