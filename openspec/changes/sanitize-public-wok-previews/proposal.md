## Why

The current WOK preview lifecycle can create a database from production before a route is made public. Public previews need a hard data boundary so test traffic can never expose production users, answers, or admin history.

## What Changes

- Make sanitized test data the default preview mode and the only mode eligible for a public `wok-preview-<id>.mhvmade.com` route.
- Create sanitized previews from an empty isolated PostgreSQL database, seed deterministic fake race-review data, and avoid copying production file state.
- Preserve the existing production checkout, database, credentials, route, and domain throughout preview creation, activation, smoke checks, and cleanup.
- Keep an explicit private clone mode only for operator use; reject it for public route activation.
- Replace the existing production-derived preview with a sanitized preview and verify its public hostname independently.

## Capabilities

### New Capabilities
- `sanitized-wok-preview-data`: Deterministic, non-production preview database and file-state seeding.

### Modified Capabilities
- `wok-preview-lifecycle`: Public route eligibility and preview creation safety requirements change.

## Impact

The WOK preview lifecycle CLI, compose/Caddy renderers, preview metadata, seed fixture script, tests, and mhv-server preview runtime are affected. Production application resources and `wheelofknowledge.com` remain outside the change and are explicitly verified after deployment.
