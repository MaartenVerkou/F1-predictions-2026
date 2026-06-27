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
- Sandbox prerequisite: `bubblewrap` is installed as `/usr/bin/bwrap`

Codex work should happen in `/srv/codex/f1/worktrees`, not directly in `/srv/f1-predictions/current`.

## Helper Commands

Run these over SSH on `mhv-server`.

Authenticate Codex for F1:

```bash
f1-codex-login
```

This runs device-code login with `CODEX_HOME=/srv/codex/f1/home`. The resulting auth cache is a secret. Until this is completed, `f1-codex-status` will show `auth_config=missing`.
After login succeeds, `f1-codex-status` should show `auth_config=present`.

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

Clean up disposable worktrees only after checking no Codex process is using them:

```bash
ps -eo pid,user,args | grep -E '[c]odex|[f]1-codex' || true
git --git-dir=/srv/codex/f1/repo worktree list
git --git-dir=/srv/codex/f1/repo worktree remove --force /srv/codex/f1/worktrees/<name>
```

## Security Rules

- Do not run F1 Codex as `root`.
- Do not point Codex at `/srv/f1-predictions/current` for normal editing.
- Do not copy production `.env` files into Codex worktrees.
- Do not print or paste `/srv/codex/f1/home/auth.json`.
- Do not give the Codex user direct production deploy rights.
- Use Git branches, patches, or pull requests for review before deployment.
- Keep Codex automation behind admin-only controls and do not expose arbitrary shell prompts to public users.

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

## SSH Operational Notes

Public SSH on port 22 receives regular internet-wide scanning. `mhv-server` keeps password authentication disabled and uses key-only root login, but it also raises SSH pre-auth connection limits to avoid legitimate admin sessions being dropped during scan bursts:

```text
MaxStartups 100:30:200
LoginGraceTime 20
MaxAuthTries 3
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin without-password
```
