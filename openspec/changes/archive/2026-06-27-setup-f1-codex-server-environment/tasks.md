## 1. Repository Documentation

- [x] 1.1 Add F1 Codex server environment operations documentation.
- [x] 1.2 Validate the OpenSpec change before implementation.

## 2. Server Provisioning

- [x] 2.1 Inspect the current MHV server Codex, F1 repo, and permission state without printing secrets.
- [x] 2.2 Create the `f1-codex` Unix user and `/srv/codex/f1` directory layout.
- [x] 2.3 Create the F1 repository mirror and initial disposable worktree under `/srv/codex/f1/worktrees`.
- [x] 2.4 Install helper commands for login, shell, worktree creation, interactive Codex, and non-interactive Codex exec.
- [x] 2.5 Configure permissions so `f1-codex` cannot read host-managed app or central infra secret files.

## 3. Verification

- [x] 3.1 Verify helper commands, Codex version, app-scoped `CODEX_HOME`, and worktree creation.
- [x] 3.2 Verify `f1-codex` cannot read production secret files.
- [x] 3.3 Run a Codex smoke check when authentication is available, or document the remaining manual login step.

## 4. Release

- [x] 4.1 Commit and push implementation documentation and task status.
- [x] 4.2 Sync specs, archive the OpenSpec change, validate all specs, and commit the archive.
