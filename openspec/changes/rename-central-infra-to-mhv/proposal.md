## Why

The production server now hosts more than Wheel of Knowledge, but the shared Docker networks, edge container, PostgreSQL container, SSH naming, and backup scripts still use `wok-*` names. That makes the central platform look app-specific and increases the chance that future apps either reuse F1-specific conventions or create their own duplicate infrastructure.

## What Changes

- Rename shared production infrastructure from `wok-*` to `mhv-*` where it represents the MHV host/platform rather than the Wheel of Knowledge app.
- Update F1's production compose overlay and operations documentation to use the MHV central web and database networks.
- Keep the Wheel of Knowledge app domain and app-specific state names unchanged where they refer to the actual product.
- Add central PostgreSQL backup automation so database dumps are scheduled and retained instead of only being manually runnable.
- Rename the host-level backup entrypoints from `wok-backup` to `mhv-backup` while preserving compatibility during the transition.

## Capabilities

### New Capabilities
- `central-backup-automation`: Covers scheduled host-level backup entrypoints and central PostgreSQL dump retention for the multi-app MHV server.

### Modified Capabilities
- `central-postgres-storage`: Central PostgreSQL SHALL be reachable through MHV-named internal infrastructure and backed up automatically.
- `production-deployment`: Production apps SHALL join the MHV central edge/database networks without taking ownership of shared infrastructure.

## Impact

- Local repo files: `docker-compose.server.yml`, operations docs, OpenSpec specs.
- Production server: Docker networks, central Caddy/PostgreSQL compose files, app compose overlays, backup scripts, cron/systemd timer state.
- Production services: brief rolling restarts may be needed for Caddy, PostgreSQL, F1, Kinara, portfolio, and apps.mhvmade.com to attach to renamed shared networks.
