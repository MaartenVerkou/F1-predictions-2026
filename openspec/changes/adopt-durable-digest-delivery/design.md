## Context

Production health reports `databaseBackend=postgres`. The running container was built from `/opt/F1-predictions-2026`, while Apps Hub points at `/srv/f1-predictions/current`. Those trees and the workspace currently contain matching runtime files, but only the workspace is a clean checkout of GitHub main. Delivery must be corrected without moving or recreating the database.

## Decisions

### 1. GitHub Actions owns image construction

CI builds once, probes `/healthz`, scans HIGH/CRITICAL findings with Trivy and publishes a commit-addressed GHCR image. Production pulls by digest and never builds.

### 2. PostgreSQL remains an external runtime dependency

`DATABASE_URL` stays server-managed and the container remains attached to `mhv-db`. The deployment health gate requires `databaseBackend=postgres`, preventing an accidental SQLite fallback.

### 3. Runtime configuration is split by ownership

Versioned race/question/roster data is baked into the image. Secrets, PostgreSQL credentials and durable state remain outside it. No database contents enter CI or the image.

### 4. Rollback is image-only

Before promotion, the current running image is tagged as the one allowed local rollback. A failed internal health or database-backend probe restores that image with unchanged environment and storage.

### 5. Source drift is reconciled only at promotion

The existing `/srv` tree is archived before it is replaced with clean GitHub main. This is a one-time delivery migration, not an application-data migration.

## Migration Plan

1. Add the contract and image pipeline; test in the existing F1 preview.
2. Obtain explicit preview approval.
3. Publish the approved commit and enable Apps Hub digest delivery.
4. Archive the current `/srv` source state, deploy the digest and verify internal health plus PostgreSQL backend.
5. Retain the previous local image until the following approved release proves normal rollback rotation.
