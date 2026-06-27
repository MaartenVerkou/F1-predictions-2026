## Why

Codex should run close to the deployed F1 app without giving it broad access to the operator's desktop or the whole production server. The server now has central MHV infrastructure, so F1 needs a professional per-app Codex environment that is safe to repeat for future apps.

## What Changes

- Create a dedicated F1 Codex runtime on `mhv-server` with its own Linux user, `CODEX_HOME`, repository mirror, worktree root, logs, and helper commands.
- Keep Codex away from the live production checkout by default; F1 Codex work SHALL happen in dedicated worktrees under `/srv/codex/f1/worktrees`.
- Configure filesystem boundaries so app code is editable while secrets and central infrastructure files remain unreadable to the Codex user.
- Add operator documentation for login, interactive use, non-interactive jobs, worktree cleanup, and future app replication.
- Do not add a public or admin web UI for arbitrary Codex prompts in this change.

## Capabilities

### New Capabilities
- `server-codex-environments`: Defines the reusable pattern for per-app Codex CLI environments on the MHV server.

### Modified Capabilities
- `production-deployment`: Production deploys SHALL remain owned by GitHub Actions/server deploy scripts, not by direct Codex writes to the live production checkout.

## Impact

- Production server: adds `f1-codex` user, `/srv/codex/f1/*`, helper commands under `/usr/local/bin`, and sudoers restrictions for controlled operator use.
- Repo docs/specs: documents the per-app Codex operating model and F1 commands.
- Security posture: Codex can work on F1 code in isolated worktrees, but cannot read host-managed env files or central infra secrets through normal Unix permissions.
