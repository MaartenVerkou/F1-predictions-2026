# F1 Codex Server Environment

F1 has a dedicated Codex CLI environment on `mhv-server`. It is intentionally separate from the live production checkout and from other future app environments.

## Runtime Layout

- Codex user: `f1-codex`
- Codex app root: `/srv/codex/f1`
- Codex home: `/srv/codex/f1/home`
- Repository mirror: `/srv/codex/f1/repo` (bare Git repository)
- Worktrees: `/srv/codex/f1/worktrees`
- Logs and notes: `/srv/codex/f1/logs`
- Live production checkout: `/srv/f1-predictions/current`

Codex work should happen in `/srv/codex/f1/worktrees`, not directly in `/srv/f1-predictions/current`.

## Helper Commands

Run these over SSH on `mhv-server`.

Authenticate Codex for F1:

```bash
f1-codex-login
```

This runs device-code login with `CODEX_HOME=/srv/codex/f1/home`. The resulting auth cache is a secret. Until this is completed, `f1-codex-status` will show `auth_config=missing`.

Open a shell as the F1 Codex user:

```bash
f1-codex-shell
```

Create a new disposable worktree:

```bash
f1-codex-new-worktree bug-123
```

Inspect the F1 Codex environment without printing secrets:

```bash
f1-codex-status
```

Start interactive Codex in a worktree:

```bash
f1-codex /srv/codex/f1/worktrees/bug-123
```

Run a non-interactive read-only Codex task:

```bash
f1-codex-exec /srv/codex/f1/worktrees/bug-123 "Summarize the likely cause of this issue"
```

## Security Rules

- Do not run F1 Codex as `root`.
- Do not point Codex at `/srv/f1-predictions/current` for normal editing.
- Do not copy production `.env` files into Codex worktrees.
- Do not print or paste `/srv/codex/f1/home/auth.json`.
- Do not give the Codex user direct production deploy rights.
- Use Git branches, patches, or pull requests for review before deployment.

The `f1-codex` user should not be able to read:

- `/srv/f1-predictions/current/.env`
- `/srv/infra/postgres/shared/.env`
- `/srv/edge/shared/.env`
- root SSH keys or root-owned migration backups

## Future Apps

Repeat the same shape per app:

```text
/srv/codex/<app>/
  home/
  repo/
  worktrees/
  logs/
```

Each app should receive its own Unix user, Codex home, repository mirror, and helper commands. Do not reuse F1's `CODEX_HOME` for other apps.
