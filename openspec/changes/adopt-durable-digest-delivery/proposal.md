## Why

F1 already uses the shared PostgreSQL service correctly, but its delivery layer still rebuilds mutable source on the server. The live container, `/opt` source, `/srv` checkout, workspace and GitHub history are not represented by one immutable release identity, making approval and rollback unnecessarily difficult.

## What Changes

- Make the repository and GHCR digest the release source of truth.
- Build, test, scan and publish immutable images in GitHub Actions.
- Keep PostgreSQL and host-managed configuration outside the image.
- Deploy only an explicitly approved digest through Apps Hub, retaining one local rollback image.
- Replace the legacy automatic SSH/source deployment workflow.

## Impact

- Delivery files: `Dockerfile`, Compose files, GitHub Actions and `scripts/deploy-app.sh`.
- Operations: Apps Hub registry and `/srv/f1-predictions/current` reconciliation.
- Data: no schema or data migration; production remains on shared PostgreSQL.
