## Context

The MHV server already hosts multiple apps and shared services:

- Central edge: `/srv/edge/current` with `mhv-caddy` on `mhv-web`.
- Central PostgreSQL: `/srv/infra/postgres/current` with `mhv-postgres` on `mhv-db`.
- Central backups: `/srv/infra/postgres/backups` plus host-level `mhv-backup` entrypoints.
- Existing apps: `/srv/f1-predictions/current`, `/srv/kinara/current`, `/srv/mhvmade-apps/current`, and `/srv/mhvmade-portfolio/current`.
- App-scoped Codex foundation for WOK/F1: `/srv/codex/f1`.

The current shape works, but app conventions are still spread across individual repos, host paths, and manual Caddy/Postgres/Codex steps. The goal is to introduce a professional platform contract that future app repos can implement consistently while preserving working production apps.

## Goals / Non-Goals

**Goals:**

- Define a reusable contract for app repository readiness, server registration, preview routing, deployment, database provisioning, backup inclusion, and Codex isolation.
- Introduce a target `/srv/apps/<app>` layout for new apps and gradual migration of existing apps.
- Keep one central edge, one central PostgreSQL service, and app-scoped Codex environments.
- Make onboarding a checklist/scriptable process rather than manual server archaeology.
- Preserve existing live routes and app paths until each app has app-specific verification and rollback.

**Non-Goals:**

- Do not move existing production checkouts in the proposal step.
- Do not replace Docker Compose with Kubernetes or another orchestrator.
- Do not expose arbitrary Codex shell execution through the public website.
- Do not merge all app repositories into one monorepo.
- Do not make direct production deploy from Codex the default path.

## Decisions

### 1. Use an app registry as the platform source of truth

Each deployed app SHALL have a registry entry containing app slug, repository, production path, target path, hostnames, Docker service names, health endpoint, database requirements, backup classifications, Codex environment, and preview naming.

Rationale: Caddy routes, database provisioning, backups, previews, and deploy automation need the same app metadata. A registry prevents every script and document from inventing its own naming.

Alternatives considered:

- Keep conventions only in docs: rejected because scripts cannot validate docs reliably.
- Infer everything from Docker Compose files: rejected because DNS, Codex, backup, and preview metadata live outside Compose.

### 2. Target `/srv/apps/<app>` without forcing an immediate move

New apps SHOULD use:

```text
/srv/apps/<app>/current
/srv/apps/<app>/shared
/srv/apps/<app>/releases
```

Existing apps MAY keep current paths until migrated through an app-specific checklist. Registry metadata records both current and target paths.

Rationale: The target layout is cleaner, but moving live apps too early creates risk and little immediate user value.

Alternatives considered:

- Move all apps now: rejected because WOK, Kinara, apps overview, and portfolio have independent runtime assumptions.
- Keep all current root-level app paths forever: rejected because it scales poorly as more apps are added.

### 3. Keep app repos separate with a common deploy contract

Each app repo SHALL provide or declare:

- Docker production runtime.
- Health endpoint.
- Migration command when a database exists.
- Environment variable contract.
- Persistent state classification.
- Test/build commands used before deploy.

Rationale: Separate repos are appropriate for independent apps, but the MHV server needs one predictable contract to run them.

### 4. Keep edge routing explicit even with wildcard DNS

Cloudflare may route all first-level `*.mhvmade.com` hostnames to the server, but Caddy SHALL only route registered app hostnames and active preview hostnames.

Rationale: Wildcard DNS removes Cloudflare clicks per app; explicit Caddy routing prevents unknown hostnames from reaching a default app.

### 5. Previews use first-level MHV hostnames and isolated state

Preview environments SHALL use hostnames such as:

```text
wok-preview-<run-id>.mhvmade.com
kinara-preview-<run-id>.mhvmade.com
```

Preview state SHALL be isolated from production databases and persistent files unless explicitly mounted read-only.

Rationale: First-level hostnames fit Cloudflare's standard SSL coverage and make admin previews reachable from any browser.

### 6. Codex remains app-scoped

Codex environments SHALL use registered app slugs and separate Unix users/CODEX_HOME values. Codex worktrees remain separate from production checkouts.

Rationale: The user wants server-side Codex without exposing personal desktop files or broad server secrets.

## Risks / Trade-offs

- Existing app paths diverge from target layout -> Keep registry fields for current path and target path; migrate one app at a time.
- Registry becomes stale -> Add validation scripts that compare registry entries to Caddy, Docker containers, health endpoints, and database roles.
- Too much platform work before user-visible value -> Implement in vertical slices: registry/docs first, then one onboarding script, then one app migration, then preview automation.
- Preview environments leak production data -> Use database snapshots/clones with admin-only access and expiry.
- Caddy wildcard accepts many hostnames -> Keep explicit routes and fail closed for unknown hostnames.
- Backup scope misses app-specific files -> Require every app registry entry to classify persistent state and backup inclusion.

## Migration Plan

1. Add the app registry schema and seed it with current apps without changing live paths.
2. Add validation commands that report current Caddy routes, Docker services, health endpoints, database roles, and backup paths.
3. Add onboarding documentation and templates for new app repos.
4. Use the contract for the next new app first.
5. Migrate existing apps to `/srv/apps/<app>` only after each app has an explicit migration checklist, backup, health check, rollback path, and successful dry run.
6. Integrate Codex preview/deploy workflows with the same registry once the admin Codex workflow is implemented.

Rollback for registry/docs changes is a Git revert. Rollback for future app path migrations must be app-specific and keep the old path available until health checks pass.

## Open Questions

- Which app should be migrated to `/srv/apps/<app>` first after the registry exists: WOK, Kinara, apps overview, or portfolio?
- Should the app registry live in this repo initially, or in a separate `mhv-platform` repo once there are more apps?
- Should Caddy config remain manually edited for V1 or be generated from the registry after validation is reliable?
