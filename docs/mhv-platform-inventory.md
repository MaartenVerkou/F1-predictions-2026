# MHV Platform Inventory

Last read-only inventory: 2026-06-30.
Portfolio path migration completed: 2026-06-30.

This inventory records what is currently running on `mhv-server`. It is intentionally descriptive: it does not imply that existing apps have already moved to the target `/srv/apps/<app>` layout.

## Shared Infrastructure

- Edge path: `/srv/edge/current`
- Edge container: `mhv-caddy`
- Edge network: `mhv-web`
- Central PostgreSQL path: `/srv/infra/postgres/current`
- Central PostgreSQL container: `mhv-postgres`
- Central PostgreSQL network: `mhv-db`
- Central PostgreSQL backups: `/srv/infra/postgres/backups`
- App-scoped Codex root: `/srv/codex`

## DNS And Routing

Cloudflare uses a first-level wildcard for MHV subdomains:

```text
*.mhvmade.com
```

Caddy routes explicit hostnames only. Unknown wildcard hostnames currently fail closed; an inventory check against `unknown-platform-check-20260630.mhvmade.com` returned `HTTP/2 525`.

Current Caddy routes:

| Hostname | Behavior | Upstream |
| --- | --- | --- |
| `wheelofknowledge.com` | App route | `f1-app:3000` |
| `www.wheelofknowledge.com` | Redirect | `wheelofknowledge.com` |
| `wok.mhvmade.com` | Redirect | `wheelofknowledge.com` |
| `kinara.mhvmade.com` | App route | `kinara-app:3000` |
| `mhvmade.com` | App route | `mhvmade-portfolio:80` |
| `www.mhvmade.com` | Redirect | `mhvmade.com` |
| `apps.mhvmade.com` | App route | `mhvmade-apps:3000` |

## Running Containers

| Container | Image | Notes |
| --- | --- | --- |
| `mhv-caddy` | `caddy:2-alpine` | Central edge |
| `mhv-postgres` | `postgres:18-alpine` | Central PostgreSQL |
| `f1predictions-app-1` | `f1predictions-app` | WOK/F1 app; healthcheck healthy |
| `kinara-app` | `current-app` | Kinara app |
| `kinara-media` | `minio/minio:latest` | Kinara media storage |
| `mhvmade-apps` | `mhvmade-apps-app` | Apps overview/admin |
| `mhvmade-portfolio` | `caddy:2-alpine` | Portfolio static edge |

## Network Attachments

| Container | Networks |
| --- | --- |
| `mhv-caddy` | `mhv-web` |
| `f1predictions-app-1` | `f1predictions_default`, `mhv-db`, `mhv-web` |
| `kinara-app` | `kinara-internal`, `mhv-db`, `mhv-web` |
| `kinara-media` | `kinara-internal` |
| `mhvmade-apps` | `mhv-web` |
| `mhvmade-portfolio` | `mhv-web` |
| `mhv-postgres` | `mhv-db` |

## App Paths

| App slug | Current path | Target path |
| --- | --- | --- |
| `wok` | `/srv/f1-predictions/current` | `/srv/apps/wok/current` |
| `kinara` | `/srv/kinara/current` | `/srv/apps/kinara/current` |
| `apps` | `/srv/mhvmade-apps/current` | `/srv/apps/apps/current` |
| `portfolio` | `/srv/apps/portfolio/current` | `/srv/apps/portfolio/current` |

## Current Health Checks

| Check | Result |
| --- | --- |
| `https://wheelofknowledge.com/healthz` | OK, database backend `postgres` |
| `https://wok.mhvmade.com` | `308` redirect to `https://wheelofknowledge.com/` |
| `https://kinara.mhvmade.com` | `200` |
| `https://apps.mhvmade.com` | `302` |
| `https://mhvmade.com` | `200` |
| Unknown wildcard hostname | `525`, fail closed |

## Compatibility Notes

- Public WOK naming should use `wok`, but existing server internals still use F1 names in several places.
- WOK production checkout remains `/srv/f1-predictions/current`.
- WOK Codex compatibility path remains `/srv/codex/f1`.
- F1/WOK is the only app with a fully documented app-scoped Codex environment at inventory time.
- Kinara currently has app-local media storage through `kinara-media` and should not be migrated without a separate media backup/restore check.
- Portfolio now runs from `/srv/apps/portfolio/current`; `/srv/mhvmade-portfolio/current` remains available as a rollback source.
