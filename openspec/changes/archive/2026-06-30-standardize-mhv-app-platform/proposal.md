## Why

The MHV server already has central Caddy, PostgreSQL, backups, and app-scoped Codex foundations, but app deployment conventions still vary by repository and server path. A standard app platform contract will make future apps repeatable to onboard, preview, deploy, back up, and operate without turning the server into undocumented manual state.

## What Changes

- Define a reusable MHV app onboarding contract for separate app repositories.
- Introduce a target server layout under `/srv/apps/<app>/current` and `/srv/apps/<app>/shared` for future apps and gradual migration of existing apps.
- Define an app registry as the source of truth for app slug, repository, public hostnames, Docker service names, health checks, database needs, backup needs, Codex environment, and preview naming.
- Standardize production app requirements: Docker runtime, health endpoint, deploy command, migration command, host-managed secrets, central network usage, and backup classification.
- Standardize preview naming and lifecycle expectations around first-level `*.mhvmade.com` hostnames such as `wok-preview-<run-id>.mhvmade.com`.
- Keep existing live app paths and hostnames operational during migration; no breaking path move is required before app-specific verification exists.

## Capabilities

### New Capabilities

- `mhv-app-platform`: Defines the shared platform contract for onboarding, registering, previewing, deploying, and operating MHV apps from separate repositories.

### Modified Capabilities

- `production-deployment`: Production deployments must follow the app registry and app contract while preserving existing deploy guarantees.
- `central-postgres-storage`: Future app database provisioning must be driven by app registry metadata and maintain per-app isolation.
- `central-backup-automation`: Backup automation must include app registry metadata for shared files, per-app persistent state, and central database dumps.
- `server-codex-environments`: App-scoped Codex environments must align with registered app slugs and preview/deploy boundaries.

## Impact

- Affected server areas: `/srv/edge`, `/srv/infra/postgres`, `/srv/codex`, existing app checkouts under `/srv/f1-predictions`, `/srv/kinara`, `/srv/mhvmade-apps`, and future `/srv/apps/<app>` paths.
- Affected docs/specs: MHV edge routing, PostgreSQL operations, Codex environment documentation, production deployment specs, backup specs, and server Codex specs.
- Affected future implementation: app registry file or service, onboarding scripts, deploy templates, Caddy route generation or validation, database provisioning scripts, backup inclusion checks, and preview environment integration.
- No immediate public API change is required. Existing public domains such as `wheelofknowledge.com`, `wok.mhvmade.com`, `kinara.mhvmade.com`, `apps.mhvmade.com`, and `mhvmade.com` remain valid.
