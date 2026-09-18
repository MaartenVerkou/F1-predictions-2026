## Why

Wheel of Knowledge is a mature app running on historical F1-compatible server paths while the MHV app platform now expects app-scoped previews, explicit routing, and repeatable runtime ownership. The platform has the DNS and shared edge primitives, but WOK lacks one reliable lifecycle that can build the current branch, copy safe test data, expose an authenticated preview, and leave production on `wheelofknowledge.com`.

## What Changes

- Define WOK as a first-class MHV app with `wok` as the public platform slug and `wheelofknowledge.com` as the production hostname.
- Add a repeatable, isolated WOK preview lifecycle for branch/ref code, cloned database/file state, app-scoped secrets, explicit Caddy routing, access protection, health checks, and expiry cleanup.
- Keep the legacy `/srv/f1-predictions/current` production path and canonical production route intact during the migration; introduce `/srv/apps/wok/current` only as a verified rollback-safe target.
- Make app-hub and deployment metadata use `wok` consistently while retaining documented F1 compatibility aliases where existing automation requires them.
- Add operator documentation and tests that prove preview isolation and production non-interference.

## Capabilities

### New Capabilities

- `wok-preview-lifecycle`: Create, verify, route, expire, and clean up isolated WOK previews.

### Modified Capabilities

- `mhv-app-platform`: Make the WOK registry and preview contract executable and explicit.
- `production-deployment`: Preserve `wheelofknowledge.com` as the production hostname while preparing a rollback-safe standard runtime path.
- `server-codex-environments`: Align app-scoped WOK worktrees and preview candidates with the `wok` platform identity while preserving the existing `/srv/codex/f1` compatibility path.

## Impact

- Adds server-safe preview scripts/configuration and operator documentation to this repository.
- Updates MHV registry/validation metadata and deployment checks; it does not change production traffic or production database state in this change.
- Requires shared MHV Caddy/Cloudflare Access cooperation for active preview hostnames, but keeps public production routing on `wheelofknowledge.com`.
