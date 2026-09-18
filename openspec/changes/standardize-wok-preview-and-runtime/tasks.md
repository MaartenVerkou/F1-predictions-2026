## 1. Registry and preview contract

- [x] 1.1 Add a registry-backed WOK preview descriptor with exact ref, preview id, hostname, resource names, expiry, and production-safety assertions.
- [x] 1.2 Add cross-platform validation for preview identifiers, `wok-preview-<id>.mhvmade.com` hostnames, and the unchanged `wheelofknowledge.com` production host.

## 2. Preview lifecycle implementation

- [x] 2.1 Implement server-side create/status/remove operations for isolated WOK worktrees, compose projects, generated secrets, cloned database/role, and disposable state.
- [x] 2.2 Render the WOK preview compose overlay and explicit Caddy route from the descriptor without copying production secret files or exposing secrets in logs.
- [x] 2.3 Gate route activation on health checks and record cleanup metadata with a seven-day expiry.
- [x] 2.4 Make cleanup exact-id and production-safe, including route removal, container/worktree cleanup, database/role cleanup, and metadata deletion.

## 3. Verification and integration

- [x] 3.1 Add unit tests for descriptor validation, resource-name isolation, secret redaction, and production-host preservation.
- [x] 3.2 Add an operator dry-run and server smoke check that verifies the preview ref, PostgreSQL backend, access-protected route, and unchanged production health.
- [x] 3.3 Update MHV/WOK operator documentation and app-hub identity guidance from legacy `f1` to public slug `wok`.
- [x] 3.4 Define the later `/srv/apps/wok` migration checklist and rollback evidence without switching production traffic in this change.
