## Context

WOK currently serves production from `/srv/f1-predictions/current` with the canonical `wheelofknowledge.com` route and an F1-compatible Docker/network identity. The MHV registry already records the public slug `wok`, target `/srv/apps/wok`, central PostgreSQL, and a preview hostname pattern, but there is no repository-owned preview command or lifecycle contract. The app-hub URL is protected by Cloudflare Access and is not a substitute for app routing.

## Goals / Non-Goals

**Goals:**

- Create an operator-invocable WOK preview from an exact Git ref in an isolated worktree.
- Clone production data into a distinct PostgreSQL database and disposable file-state directory, with a unique preview role and generated secrets.
- Route only active previews through explicit `wok-preview-<id>.mhvmade.com` Caddy entries protected by the existing edge access policy.
- Keep production traffic, hostname, database, secrets, and rollback path unchanged while preview or path migration work is in progress.
- Make a later `/srv/apps/wok` migration a separate, health-gated operation.

**Non-Goals:**

- No new physical server or replacement of shared MHV PostgreSQL/Caddy.
- No immediate production hostname change and no direct branch-to-production mutation.
- No generic public app-hub rewrite in this change; the hub can link to WOK using the stable `wok` slug after its catalog contract is confirmed.

## Decisions

### Use logical app isolation on the shared host

WOK receives its own compose project, worktree, database/role, secrets, preview state, and hostname while sharing the established MHV host and networks. A dedicated server would duplicate edge, backup, and database responsibilities without solving the lifecycle gap.

### Use explicit preview lifecycle commands

Add create/status/remove commands that validate the registry, require an exact ref, generate an isolated resource name, clone data, render a preview overlay, apply an explicit Caddy route, and verify `/healthz`. Removal must require the exact preview identifier and remove only resources recorded for that preview.

### Keep the canonical production hostname stable

Production remains `wheelofknowledge.com` (with existing redirects). The compatibility names `f1` and `wok.mhvmade.com` remain internal/redirect metadata only until a separately approved migration removes them.

### Treat path migration as a second phase

First prove preview and rollback on the existing production path. Only then add a target checkout at `/srv/apps/wok/current`, run it alongside the old checkout, and switch Caddy after health and state checks pass.

## Risks / Trade-offs

- [A cloned database may contain private user data] → Keep previews access-protected, use unique credentials, bind local previews privately by default, and expire them automatically.
- [Preview routing can accidentally shadow production] → Generate only first-level `wok-preview-*` hosts and validate exact Caddy blocks before reload.
- [Legacy F1 naming can leak into new automation] → Resolve paths, service aliases, and compatibility values from the registry rather than hard-coding public slugs.
- [A failed path migration could interrupt production] → Keep the old checkout and Caddy route, require health-gated cutover, and document rollback commands.

## Migration Plan

1. Land and validate preview lifecycle tooling without changing production.
2. Create one authenticated preview from the admin-review branch and verify app, database isolation, routing, and cleanup.
3. Update app-hub metadata to use `wok` as the stable identity, keeping the canonical production URL unchanged.
4. Prepare `/srv/apps/wok` as a parallel production candidate and run the migration preflight.
5. Switch production only after an explicit operator-approved cutover; retain the legacy path for rollback.

## Open Questions

- Where should the shared app-hub catalog store the WOK link and Cloudflare Access policy identifier? This is an integration detail to resolve with the app-hub repository owner before wiring automatic links.
