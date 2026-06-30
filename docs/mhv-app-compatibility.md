# MHV App Compatibility Report

Last reviewed: 2026-06-30.

This report compares the existing apps with the MHV app platform contract and records completed compatibility migrations.

## Summary

| App | Registry | Caddy | Health | Central DB | Codex | Path status | Migration readiness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WOK | Yes | Yes | Yes | Yes | Yes, compatibility path | Non-standard | Needs migration checklist |
| Kinara | Yes | Yes | Yes | Yes | No | Non-standard | Needs media backup validation |
| Apps overview | Yes | Yes | Yes | No | No | Standard | Migrated; validate file-state backup policy |
| Portfolio | Yes | Yes | Yes | No | No | Standard | Migrated; observe and keep rollback path |

## WOK

Registry slug: `wok`

Current state:

- Production path: `/srv/f1-predictions/current`
- Target path: `/srv/apps/wok/current`
- Canonical hostname: `wheelofknowledge.com`
- MHV redirect: `wok.mhvmade.com`
- Container: `f1predictions-app-1`
- Caddy upstream: `f1-app:3000`
- Database: central PostgreSQL through `mhv-postgres`
- Codex compatibility path: `/srv/codex/f1`

Compatibility exceptions:

- Internal server paths and helper commands still use F1 naming.
- Codex path uses `/srv/codex/f1` while public platform slug is `wok`.
- WOK should not be the first `/srv/apps` migration because it has real user data, central PostgreSQL, and the active Codex environment.

Required before migration:

- Confirm current deploy workflow can target `/srv/apps/wok/current`.
- Confirm rollback to `/srv/f1-predictions/current`.
- Confirm `/var/lib/wheelofknowledge/state` restore needs after PostgreSQL cutover.
- Confirm Codex helpers still point at worktrees and not production checkout.

## Kinara

Registry slug: `kinara`

Current state:

- Production path: `/srv/kinara/current`
- Target path: `/srv/apps/kinara/current`
- Canonical hostname: `kinara.mhvmade.com`
- Container: `kinara-app`
- Supporting container: `kinara-media`
- Caddy upstream: `kinara-app:3000`
- Database: central PostgreSQL through `mhv-postgres`

Compatibility exceptions:

- Repository origin was not discovered during the read-only inventory.
- Media state exists through `kinara-media` and must be validated before migration.
- Backup and restore notes for media state are not yet complete.

Required before migration:

- Document repository origin.
- Confirm MinIO/media durable state path.
- Confirm media backup and restore procedure.
- Confirm rollback to `/srv/kinara/current`.

## MHV Apps Overview

Registry slug: `apps`

Current state:

- Production path: `/srv/apps/apps/current`
- Previous rollback path: `/srv/mhvmade-apps/current`
- Shared path: `/srv/apps/apps/shared`
- Previous shared rollback path: `/srv/mhvmade-apps/shared`
- Canonical hostname: `apps.mhvmade.com`
- Container: `mhvmade-apps`
- Caddy upstream: `mhvmade-apps:3000`
- Database: none registered

Compatibility exceptions:

- Repository origin was not discovered during the read-only inventory.
- File-state backup and restore notes for `/srv/apps/apps/shared` still need validation before marking backup coverage complete.

Migration result:

`apps` was migrated to `/srv/apps/apps/current` on 2026-06-30. Shared data now mounts from `/srv/apps/apps/shared/data`. The previous `/srv/mhvmade-apps/current` and `/srv/mhvmade-apps/shared` paths remain intact as rollback sources.

Remaining follow-up:

- Document repository origin.
- Validate file-state backup and restore procedure for `/srv/apps/apps/shared`.

## MHV Portfolio

Registry slug: `portfolio`

Current state:

- Production path: `/srv/apps/portfolio/current`
- Previous rollback path: `/srv/mhvmade-portfolio/current`
- Canonical hostname: `mhvmade.com`
- Redirect: `www.mhvmade.com`
- Container: `mhvmade-portfolio`
- Caddy upstream: `mhvmade-portfolio:80`
- Database: none registered
- Durable file state: none registered

Compatibility exceptions:

- Repository origin was not discovered during the read-only inventory.

Migration result:

`portfolio` was migrated to `/srv/apps/portfolio/current` on 2026-06-30 because it was the lowest-risk registered app: static, no registered database, no registered durable file state, and a simple Caddy upstream. The previous `/srv/mhvmade-portfolio/current` path remains intact as rollback source.
