# WOK preview lifecycle

Wheel of Knowledge is a first-class `wok` app on the shared MHV server. A
preview is an isolated runtime on `mhv-server`; it is not served through the
app-hub URL and it never replaces the production checkout.

## Identity and URLs

- Production remains `https://wheelofknowledge.com`.
- `wok.mhvmade.com` is a compatibility redirect only.
- A preview uses `https://wok-preview-<id>.mhvmade.com`.
- The preview hostname must be covered by the existing Cloudflare Access
  policy before its Caddy route is activated.

The app-hub catalog can link to the stable `wok` slug, but the direct preview
hostname is the operational URL. This keeps the mature app independent from
the app-hub UI implementation.

## Plan locally

The plan and render commands are side-effect free and work on Windows:

```powershell
npm run platform:wok-preview -- plan `
  --id admin-race-review-20260918 `
  --ref codex/streamline-admin-race-result-review `
  --json

npm run platform:wok-preview -- render `
  --id admin-race-review-20260918 `
  --ref codex/streamline-admin-race-result-review `
  --json
```

The rendered descriptor proves the exact ref, preview hostname, isolated
PostgreSQL names, seven-day expiry, and the unchanged production host. It does
not read or print production credentials.

## Create a server preview

Run the lifecycle from the candidate checkout that contains this script (or
from the deployed `main` checkout after it is merged), not from the live
container. `mhv-server` intentionally has no Node installation; the checked-in
`wok-preview-server.sh` helper runs the lifecycle in the pinned Node tooling
image with only the required host paths mounted. The command fetches the exact
ref, creates a detached worktree, clones PostgreSQL into a `wok_preview_*`
database and role, clones disposable file state, generates a private `.env`,
builds the container, and waits for `/healthz`.

```bash
ssh mhv-server
cd /srv/f1-predictions/previews/_wok-preview-tooling-20260918
./scripts/wok-preview-server.sh create \
  --id admin-race-review-20260918 \
  --ref codex/streamline-admin-race-result-review \
  --json
```

This creates a healthy but unrouted preview. To make it reachable publicly,
first confirm the Cloudflare Access policy covers the exact hostname, then
activate the explicit Caddy route:

```bash
./scripts/wok-preview-server.sh activate \
  --id admin-race-review-20260918 \
  --access-confirmed true \
  --json
```

Route activation is health-gated and reloads Caddy only after its configuration
validates. It appends a marker-scoped block for the preview and leaves the
`wheelofknowledge.com` block untouched. The command deliberately requires the
explicit `--access-confirmed true` acknowledgement; the generated Caddy file
does not contain credentials.

## Inspect, smoke-test, and clean up

```bash
./scripts/wok-preview-server.sh status --id admin-race-review-20260918 --json
./scripts/wok-preview-server.sh smoke --id admin-race-review-20260918 --json
./scripts/wok-preview-server.sh remove --id admin-race-review-20260918 --json
```

Status redacts database passwords and session secrets. The smoke check requires
an installed route, confirmed access protection, a reachable preview (200/302/
401/403 are accepted at the edge), and a healthy PostgreSQL-backed production
`/healthz` response.

Expired previews can be reviewed without mutation and then removed explicitly:

```bash
./scripts/wok-preview-server.sh cleanup --json
./scripts/wok-preview-server.sh cleanup --apply true --json
```

Cleanup is exact-id scoped. It removes only the preview route, compose project,
worktree, cloned database/role, state directory, and metadata. Production
containers, the production database, host-managed secrets, and the canonical
route are not cleanup targets.

## Later `/srv/apps/wok` migration

Path migration is intentionally separate from preview creation. Before moving
production from `/srv/f1-predictions/current` to `/srv/apps/wok/current`, an
operator must record:

1. a verified PostgreSQL and file-state restore point;
2. preserved host-managed secrets and the old checkout as rollback;
3. a parallel target compose runtime using the registered `wok` metadata;
4. a passing target `/healthz` with `databaseBackend: postgres`;
5. a Caddy diff that still keeps `wheelofknowledge.com` as the canonical host;
6. a rollback test that restores the previous route without data loss.

If any target check fails, production stays on the legacy path. No preview
operation changes production traffic.
