# Codex Instructions

This is the durable Wheel of Knowledge / F1 Predictions app (`f1`).

- Work only in `/home/mhv-operator/workspace/f1`; never edit `/srv` or `/opt` application source.
- Read `mhv-app.yaml` and the relevant OpenSpec change before non-trivial work.
- PostgreSQL is the production source of truth. Never copy production data into an image or preview.
- Secrets and `DATABASE_URL` are server-owned; never print, commit or replace them.
- Use OpenSpec for features, architecture and data-model changes. Use focused tests for small fixes.

## Change loop

1. Inspect Git state and the relevant code/specs.
2. Make one coherent change and run `checks.fast` from `mhv-app.yaml`.
3. For visible or runtime changes, run release checks and refresh the Apps Hub preview.
4. Verify `/healthz` and critical Playwright flows, then wait for explicit preview approval.

## Approved release

After approval, commit and push `main`, wait for CI and Trivy to pass, and deploy only the approved immutable GHCR digest through Apps Hub. Always dry-run first. Production must report `databaseBackend=postgres`; otherwise restore the retained rollback image. Never use `latest` and never build the production image on the server.
