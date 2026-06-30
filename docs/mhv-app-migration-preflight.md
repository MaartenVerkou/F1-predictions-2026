# MHV App Path Migration Preflight

Use this before moving an existing app from its compatibility path to `/srv/apps/<app>/current`.

Do not migrate more than one production app at a time.

## Candidate

Recommended first candidate: `portfolio`.

Reason: it is the lowest-risk registered app because it has no registered PostgreSQL database, no registered durable file state, and a simple Caddy upstream. This is still not approval to move it until the checklist below is complete.

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
