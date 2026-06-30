## 1. Inventory And Registry Foundation

- [x] 1.1 Inventory live server apps, Caddy routes, Docker services, network attachments, health endpoints, database usage, Codex environments, and backup paths without changing server state.
- [x] 1.2 Define the app registry schema for slug, repository, paths, hostnames, Docker services, health checks, database metadata, backup state, Codex metadata, and preview naming.
- [x] 1.3 Seed the registry with current apps: WOK/F1, Kinara, MHV apps overview, and MHV portfolio.
- [x] 1.4 Add validation that registry slugs are unique and required fields are present.
- [x] 1.5 Add validation that registered hostnames match current Caddy behavior and unknown wildcard hostnames fail closed.

## 2. App Repository Contract

- [x] 2.1 Document the required app repo contract for Docker runtime, health endpoint, environment variables, build/test commands, migration command, and persistent state classification.
- [x] 2.2 Add a reusable onboarding checklist/template for future app repositories.
- [x] 2.3 Validate WOK/F1 against the contract and document compatibility exceptions.
- [x] 2.4 Validate Kinara against the contract and document compatibility exceptions.
- [x] 2.5 Validate MHV apps overview and MHV portfolio against the contract and document compatibility exceptions.

## 3. Server Layout And Migration Guardrails

- [x] 3.1 Document `/srv/apps/<app>/current`, `/srv/apps/<app>/shared`, and optional release/rollback directories as the target layout.
- [x] 3.2 Add a dry-run migration checklist for moving one existing app to `/srv/apps/<app>` without changing public hostnames.
- [x] 3.3 Add preflight checks for backups, host-managed secrets, Docker Compose files, health endpoints, and rollback path before any app path migration.
- [x] 3.4 Choose the first low-risk app migration candidate and record why it is first.
- [x] 3.5 Do not move production app paths until the selected app's preflight checks and rollback steps are documented and reviewed.

## 4. Deployment Integration

- [x] 4.1 Update deployment documentation to use registry metadata for production path, Docker service names, health endpoint, and migration commands.
- [x] 4.2 Add deployment validation that fails before modifying server state when an app is not registered.
- [x] 4.3 Add deployment validation that health checks use the registry entry.
- [x] 4.4 Add migration failure handling guidance so failed app migrations do not switch Caddy routing.

## 5. PostgreSQL And Backup Integration

- [x] 5.1 Add database provisioning documentation or scripts driven by registry database metadata.
- [x] 5.2 Add checks that PostgreSQL apps receive isolated database roles and do not reuse another app's role.
- [x] 5.3 Add backup validation for registered persistent file-state paths.
- [x] 5.4 Add restore notes requirements for apps with PostgreSQL or durable file state.

## 6. Codex And Preview Integration

- [x] 6.1 Align Codex documentation with registered app slugs while preserving existing compatibility paths such as `/srv/codex/f1`.
- [x] 6.2 Add registry fields for app-scoped Codex user, Codex home, repository mirror, worktrees, and logs.
- [x] 6.3 Define preview hostname generation from registry slug, such as `wok-preview-<run-id>.mhvmade.com`.
- [x] 6.4 Add cleanup requirements for preview route, container, database clone, and file-state clone.
- [x] 6.5 Keep Codex production deploy behavior Git-backed and separate from direct live checkout mutation.

## 7. Verification And Rollout

- [x] 7.1 Run `openspec validate standardize-mhv-app-platform --strict`.
- [x] 7.2 Run registry validation against the live server without changing server state.
- [x] 7.3 Confirm existing public routes still work: `wheelofknowledge.com`, `wok.mhvmade.com`, `kinara.mhvmade.com`, `apps.mhvmade.com`, and `mhvmade.com`.
- [x] 7.4 Commit proposal artifacts separately from implementation changes.
- [ ] 7.5 After implementation and verification, archive the OpenSpec change and merge updated specs.
