## 1. Repository Updates

- [ ] 1.1 Update the F1 production compose overlay to use `mhv-web` and `mhv-db`.
- [ ] 1.2 Update F1 operations and observability documentation to describe MHV-named central infrastructure and backups.
- [ ] 1.3 Validate the OpenSpec change and Docker Compose overlay locally.

## 2. Server Migration

- [ ] 2.1 Back up current server compose, cron, and central PostgreSQL state before renaming shared infrastructure.
- [ ] 2.2 Create `mhv-web` and `mhv-db` Docker networks and update central edge/PostgreSQL compose files.
- [ ] 2.3 Update app compose files and host-managed database connection hostnames to use `mhv-*` shared infrastructure.
- [ ] 2.4 Recreate central and app containers with `mhv-caddy`, `mhv-postgres`, `mhv-web`, and `mhv-db`.

## 3. Backup Automation

- [ ] 3.1 Install MHV-named host-level backup and prune entrypoints while preserving existing backup secrets.
- [ ] 3.2 Add scheduled central PostgreSQL dump automation with local retention.
- [ ] 3.3 Run a manual backup verification without printing secrets.

## 4. Verification And Release

- [ ] 4.1 Verify production Docker containers, networks, F1 health, and public routes for all hosted apps.
- [ ] 4.2 Commit and push the implementation changes.
- [ ] 4.3 Sync specs, archive the OpenSpec change, validate all specs, and commit the archive.
