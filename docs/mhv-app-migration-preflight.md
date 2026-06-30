# MHV App Path Migration Preflight

Use this before moving an existing app from its compatibility path to `/srv/apps/<app>/current`.

Do not migrate more than one production app at a time.

## Completed Migrations

- `portfolio`: completed on 2026-06-30. Portfolio now runs from `/srv/apps/portfolio/current`; `/srv/mhvmade-portfolio/current` remains available as rollback source.
- `apps`: completed on 2026-06-30. Apps overview now runs from `/srv/apps/apps/current`; `/srv/mhvmade-apps/current` and `/srv/mhvmade-apps/shared` remain available as rollback sources.

## Next Candidate

There is no automatic next candidate. WOK has production user data, central PostgreSQL, and the app-scoped Codex environment. Kinara has media state through `kinara-media`. Both need app-specific backup, restore, and rollback validation before migration.

## Preflight Checklist

1. Confirm registry entry

```bash
npm run platform:validate-registry
```

2. Confirm live state before migration

```bash
npm run platform:validate-live
```

3. Record current app state

- Current production path.
- Target production path.
- Current Caddy route.
- Current container name.
- Current Docker networks.
- Current health result.
- Current repository origin.
- Current host-managed secret paths.
- Current durable file-state paths.

4. Confirm backup coverage

- PostgreSQL dump exists when the app uses PostgreSQL.
- Durable file-state paths are included in host backup or documented elsewhere.
- Restore notes identify where state is restored.

5. Prepare rollback

- Keep the old production path intact.
- Keep the old Caddy route available until the new path passes health checks.
- Keep host-managed secrets untouched.
- Record the exact command to recreate the previous container.

6. Dry-run target runtime

- Create target directories.
- Copy or check out code to target path.
- Attach only required networks.
- Start the target runtime without switching Caddy traffic when possible.
- Verify health endpoint.

7. Cutover

- Switch Caddy route only after target health succeeds.
- Reload Caddy only after validation succeeds.
- Run live registry validation after reload.

8. Post-cutover observation

- Check health endpoint.
- Check recent container logs.
- Check public route through Cloudflare.
- Keep rollback path until the app has been stable for the agreed observation window.

## Rollback Rule

If health checks fail after cutover:

- Point Caddy back to the previous upstream.
- Reload Caddy.
- Confirm previous public health.
- Leave the failed target path in place for diagnosis.
- Do not delete old state during the same incident.
