# MHV App Platform

The MHV app platform is the shared contract for running separate app repositories on `mhv-server`.

The platform does not require every existing app to move immediately. Existing apps can keep compatibility paths while new apps use the standard layout from day one.

## Target Server Layout

New apps should use:

```text
/srv/apps/<app>/current
/srv/apps/<app>/shared
/srv/apps/<app>/releases
```

- `current`: deployed checkout/runtime bundle.
- `shared`: host-managed secrets, uploads, file state, and other durable app-owned state.
- `releases`: optional release or rollback directories when an app needs release rotation.

Existing apps remain valid at their current paths until migrated through an app-specific checklist.

## App Registry

The registry lives at:

```text
ops/mhv-app-registry.json
```

Each app entry should include:

- `slug`: stable platform slug, such as `wok` or `kinara`.
- `displayName`: human-readable app name.
- `repository`: source repository metadata.
- `paths`: current and target server paths.
- `hostnames`: canonical, redirects, and aliases.
- `docker`: service/container names and network aliases.
- `health`: health check URL and expected result.
- `database`: central PostgreSQL requirements and database identity.
- `state`: durable and disposable file-state paths.
- `backup`: backup inclusion notes.
- `codex`: app-scoped Codex user, home, repo, worktree, and compatibility paths.
- `preview`: hostname pattern and retention expectations.
- `compatibilityNotes`: known exceptions while existing apps migrate.

## Onboarding Rule

A new app is not production-ready on MHV until it has:

- A registry entry.
- A Docker production runtime.
- A health endpoint.
- Documented build/test/deploy verification commands.
- Documented environment variables without secret values.
- Explicit database and persistent-state classification.
- Backup and restore notes for durable state.
- Caddy routing that is explicit, not a catch-all wildcard.
- App-scoped Codex metadata when Codex will work on that app.

## Migration Rule

Moving an existing app to `/srv/apps/<app>` is a separate operation from normal deployment.

Before a move:

- Confirm backups exist for database and file state.
- Confirm host-managed secrets are outside Git and will be preserved.
- Confirm the target Compose/runtime can start without changing public hostnames.
- Confirm a health check.
- Keep a rollback path to the previous checkout until the migrated app is healthy.

Do not move multiple production apps in one migration step.

## Deployment Rule

Production deployment automation should read from the registry instead of hard-coding per-app assumptions:

- Deploy to `paths.currentProduction`.
- Use `docker.appService` and `docker.appContainer`.
- Verify `health.url` and `health.expectedStatus`.
- Run or explicitly skip the app's migration command from the repository contract.
- Fail before modifying server state when the app slug is not registered.

Path migrations are not normal deploys. A migration must pass the preflight in `docs/mhv-app-migration-preflight.md` before Caddy traffic is changed.

## PostgreSQL Rule

Apps using central PostgreSQL must declare:

- `database.usesPostgres: true`
- `database.host: mhv-postgres`
- `database.network: mhv-db`
- unique `database.databaseKey`
- unique `database.roleKey`

`npm run platform:validate-registry` checks that PostgreSQL database and role keys are not reused across registered apps.

## Backup Rule

Every durable state path in `state.durableFilePaths` needs one of:

- central PostgreSQL backup coverage,
- host-level file backup coverage,
- or an explicit `needs-validation` note before migration.

Apps with `needs-validation` backup status can stay registered, but they should not be path-migrated until restore notes exist.

## Live Validation

Run the read-only live validator after registry or Caddy changes:

```bash
npm run platform:validate-live
```

It checks that registered hostnames and upstreams appear in Caddy, registered containers are attached to expected Docker networks, health endpoints return expected statuses, and an unknown wildcard hostname fails closed.
