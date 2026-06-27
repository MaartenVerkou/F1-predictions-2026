## Context

Codex CLI is installed centrally on `mhv-server` under `/opt/codex` with `/usr/local/bin/codex` on the PATH. The server now hosts multiple apps and central MHV infrastructure. Running Codex as root or directly in `/srv/f1-predictions/current` would give it more access than it needs and risks accidental edits to the live production checkout.

OpenAI's Codex documentation distinguishes Codex CLI local execution from cloud execution, notes that CLI authentication is cached in `CODEX_HOME`, recommends device authentication for headless devices, and describes permissions/sandboxing as the control layer for filesystem access. This design uses those primitives but also relies on Unix account boundaries because Codex sandbox settings are not a substitute for host-level least privilege.

## Goals / Non-Goals

**Goals:**

- Provide a ready-to-use F1 Codex environment on `mhv-server`.
- Make the environment repeatable for future apps through a consistent `/srv/codex/<app>` layout.
- Ensure Codex works in a dedicated mirror/worktree area rather than the live deployment checkout.
- Prevent normal Codex runs from reading production secrets or central MHV infra secrets.
- Provide simple operator commands for interactive and non-interactive use.

**Non-Goals:**

- Build a Wheel of Knowledge admin UI for Codex jobs.
- Grant Codex permission to deploy directly to production.
- Store or copy the user's personal Codex auth token.
- Migrate other apps to the same pattern in this change.
- Solve GitHub write access for automated PR creation.

## Decisions

1. Use a dedicated Unix account named `f1-codex`.

   The account owns `/srv/codex/f1` and cannot rely on root-owned production files being readable. This makes the OS the first isolation boundary.

2. Use `/srv/codex/f1/home` as `CODEX_HOME`.

   Codex auth, config, sessions, and logs are app-scoped. Future apps can repeat the pattern with `/srv/codex/<app>/home`.

3. Use a separate F1 Git mirror and worktrees under `/srv/codex/f1`.

   The mirror provides a stable source for worktrees. Worktrees provide disposable branches for Codex changes. The live checkout at `/srv/f1-predictions/current` remains deployment state, not the editing workspace.

4. Use helper commands instead of asking operators to remember environment variables.

   `f1-codex-login`, `f1-codex-shell`, `f1-codex-new-worktree`, `f1-codex`, and `f1-codex-exec` set `CODEX_HOME`, `HOME`, and safe defaults consistently.

5. Do not make Codex auth automatic.

   The operator must run device login manually. `auth.json` remains secret and must not be printed or committed.

## Risks / Trade-offs

- The first operator login is manual -> provide `f1-codex-login` and clear docs.
- `f1-codex` may not be able to push branches if GitHub credentials are not configured -> treat this as intentional; patches can be reviewed first and GitHub write access can be added later.
- Some tests may need secrets or production-like env -> default Codex worktrees do not get production `.env`; use local test env files only when explicitly created.
- Unix permissions can drift as deploy tooling changes -> include verification commands that prove secret files are not readable by `f1-codex`.

## Migration Plan

1. Create OpenSpec artifacts and commit the proposal.
2. Add repo documentation for the F1 Codex server environment.
3. On `mhv-server`, create `f1-codex`, `/srv/codex/f1`, a repository mirror, and helper commands.
4. Verify Codex version, filesystem permissions, secret denial, worktree creation, and a read-only `codex exec` smoke if authenticated.
5. Sync specs, archive the OpenSpec change, and commit the archive.

Rollback: remove the helper commands and disable or remove the `f1-codex` account after preserving any wanted worktrees. No production app data is modified by the setup.
