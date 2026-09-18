## Context

The existing preview lifecycle provisions isolated resources but restores a production PostgreSQL dump and copies durable file state. That is useful for private debugging but unsafe as the basis for a public preview. The app already creates its PostgreSQL schema on startup and supports a development-only auto-login identity, so a sanitized preview can be initialized without any production data or credentials.

## Goals / Non-Goals

**Goals:**

- Make public previews provably independent from production data and durable state.
- Provide deterministic race-review fixtures so `/admin/actuals` can be inspected immediately.
- Keep the current shared mhv-server/Caddy deployment model and hostname convention.
- Preserve an explicitly named private clone path for diagnostics without allowing it to become public.

**Non-Goals:**

- Changing production application behavior, schema, or `wheelofknowledge.com`.
- Making sanitized preview data a backup or replication mechanism.
- Exposing production credentials or adding a second production database.

## Decisions

1. **Explicit data mode.** Preview descriptors carry `dataMode: sanitized|clone`, defaulting to `sanitized`. Public activation requires `sanitized`; this is enforced from metadata on the server, not only by CLI convention.
2. **Empty database plus fixture seed.** Sanitized creation provisions a new database and role but skips `pg_dump`. After the app is healthy, a checked-in seed script inserts fake snapshots and actual values using the app's normal database adapter. This reuses the app schema bootstrap and avoids a parallel schema definition.
3. **No durable state copy.** Sanitized previews receive an empty state directory. Static question, roster, race, and last-season files come only from the selected Git ref.
4. **Development-only preview identity.** Sanitized previews run with `NODE_ENV=development`, `DEV_AUTO_LOGIN=1`, and a preview-specific fake identity. This gives an operator a usable admin review surface while all writes remain in the isolated preview database. Production routes continue to run with their existing production environment.
5. **Route guard and smoke evidence.** Caddy route rendering and activation reject clone-mode metadata. Public smoke checks continue to verify preview reachability and production PostgreSQL health; sanitized mode is included in status evidence.

## Risks / Trade-offs

- [Development auto-login is intentionally admin-capable] -> Keep it limited to the sanitized preview container, use a generated session secret, add no production credentials, and keep the route explicitly marked noindex/test-only.
- [Fixture drift from admin UI expectations] -> Seed through the existing schema and add lifecycle/unit coverage for the fixture's required snapshot and value rows.
- [A stale clone preview may remain on the server] -> Remove the existing preview by exact id before recreating it, then verify its database and route are absent before activation.
- [Shared Caddy remains an operational dependency] -> Validate and reload Caddy transactionally, with a rollback of the route file on failure.

## Migration Plan

1. Implement data-mode guards, the sanitized seed script, and tests.
2. Deploy the lifecycle tooling to mhv-server.
3. Remove the existing production-derived preview by its exact id.
4. Create the same id in sanitized mode from the requested exact Git ref.
5. Activate the public route only after health and production invariants pass.
6. Verify the public URL, preview seed, preview database identity, and unchanged production health.

Rollback is limited to removing the preview and its route/resources; no production resource is modified by the change.

## Open Questions

None for this implementation. Public preview access remains intentionally test-oriented and noindex.
