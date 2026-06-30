# MHV App Onboarding Checklist

Use this checklist before a separate repository becomes an MHV production app.

## 1. Registry

- Choose a stable app slug, for example `wok`, `kinara`, or `portfolio`.
- Add the app to `ops/mhv-app-registry.json`.
- Set the current production path and target `/srv/apps/<app>/current` path.
- Set canonical hostname, redirects, Docker service/container names, health URL, database needs, backup state, Codex settings, and preview hostname pattern.
- Run:

```bash
npm run platform:validate-registry
```

## 2. Repository Contract

The app repository must declare:

- Production Docker runtime.
- Health endpoint.
- Build command.
- Test command.
- Deploy verification command.
- Environment variables without secret values.
- Migration command, or explicit `none`.
- Persistent state paths and whether they are durable or disposable.

Recommended files:

```text
Dockerfile
docker-compose.yml
docker-compose.server.yml
.env.example
README.md
```

## 3. Server Runtime

- New apps should deploy to `/srv/apps/<app>/current`.
- Host-managed secrets and durable files should live under `/srv/apps/<app>/shared`.
- App containers should join `mhv-web` when Caddy routes to them.
- Apps using central PostgreSQL should join `mhv-db` and connect to `mhv-postgres`.
- Do not publish app or database ports publicly unless there is a documented reason.

## 4. Caddy And DNS

- Cloudflare wildcard DNS handles first-level subdomains under `mhvmade.com`.
- Caddy must explicitly route every production and active preview hostname.
- Unknown wildcard hostnames must fail closed.
- After Caddy changes, run:

```bash
npm run platform:validate-live
```

## 5. Database

For PostgreSQL apps:

- Create a dedicated database.
- Create a dedicated role.
- Do not reuse another app's credentials.
- Document migration and restore commands.
- Confirm deployment fails visibly when migrations fail.

## 6. Backups

- List durable PostgreSQL state.
- List durable file state.
- Confirm central PostgreSQL dumps cover the app database.
- Confirm host-level backup includes durable file-state paths or document where they are backed up.
- Add restore notes before migration or production launch.

## 7. Codex

If Codex will work on the app:

- Create a dedicated Unix user.
- Create a dedicated Codex home.
- Create a dedicated repository mirror and worktree path.
- Do not reuse another app's `CODEX_HOME`.
- Keep Codex worktrees separate from production checkouts.

## 8. Preview

- Use first-level hostnames such as `<app>-preview-<run-id>.mhvmade.com`.
- Use isolated preview database/file-state clones.
- Register preview Caddy routes only while the preview is active.
- Remove preview containers, routes, and cloned state on expiry.

## 9. Launch Gate

Before production traffic:

- Registry validates locally.
- Live registry validation passes.
- Health endpoint returns expected status.
- Database connectivity is verified where applicable.
- Backup and restore notes exist.
- Rollback path is documented.
