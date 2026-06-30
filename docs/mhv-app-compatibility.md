# MHV App Compatibility Report

Last reviewed: 2026-06-30.

This report compares the existing apps with the MHV app platform contract. It does not approve moving any app path yet.

## Summary

| App | Registry | Caddy | Health | Central DB | Codex | Path status | Migration readiness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WOK | Yes | Yes | Yes | Yes | Yes, compatibility path | Non-standard | Needs migration checklist |
| Kinara | Yes | Yes | Yes | Yes | No | Non-standard | Needs media backup validation |
| Apps overview | Yes | Yes | Yes | No | No | Non-standard | Good low-risk candidate after backup check |
| Portfolio | Yes | Yes | Yes | No | No | Non-standard | Best first path migration candidate |

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

- Production path: `/srv/mhvmade-apps/current`
- Target path: `/srv/apps/apps/current`
- Canonical hostname: `apps.mhvmade.com`
- Container: `mhvmade-apps`
- Caddy upstream: `mhvmade-apps:3000`
- Database: none registered

Compatibility exceptions:

- Repository origin was not discovered during the read-only inventory.
- Shared path `/srv/mhvmade-apps/shared` exists and needs restore notes.

Required before migration:

- Document repository origin.
- Confirm what `/srv/mhvmade-apps/shared` contains.
- Confirm admin login/session behavior after migration.
- Confirm rollback to `/srv/mhvmade-apps/current`.

## MHV Portfolio

Registry slug: `portfolio`

Current state:

- Production path: `/srv/mhvmade-portfolio/current`
- Target path: `/srv/apps/portfolio/current`
- Canonical hostname: `mhvmade.com`
- Redirect: `www.mhvmade.com`
- Container: `mhvmade-portfolio`
- Caddy upstream: `mhvmade-portfolio:80`
- Database: none registered
- Durable file state: none registered

Compatibility exceptions:

- Repository origin was not discovered during the read-only inventory.

Recommended first migration candidate:

`portfolio` is the lowest-risk first `/srv/apps/<app>` migration candidate because it appears to be static, has no registered database, no registered durable file state, and a simple Caddy upstream. It still needs a documented repository origin and rollback path before moving.
