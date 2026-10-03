# Repository hygiene inventory

This is the review checklist for keeping the Wheel of Knowledge repository and
its OpenSpec work understandable. It is intentionally non-destructive: files
are classified before they are archived or removed.

## Canonical source

- GitHub repository: `MaartenVerkou/F1-predictions-2026`
- Production branch: `main`
- Canonical app identity: `wok` / Wheel of Knowledge
- Compatibility identity: `f1` (historical source and server path only)
- Production database: PostgreSQL database key `f1_predictions`
- Production domain: `wheelofknowledge.com`

## Planning inventory

Every change folder must be classified as one of:

| Classification | Meaning | Action |
| --- | --- | --- |
| Active | Work is still intended and has an implementation owner | Keep and continue through OpenSpec |
| Completed | Implementation and release verification are complete | Archive after the final main merge |
| Superseded | A later change replaced the behavior or contract | Record the replacement and archive |
| Historical | Kept only as an architectural record | Move to the archive, never reuse for new work |

The current review should pay particular attention to overlapping
canonical-dataflow, race-review, and deployment changes before starting
another feature branch.

### Snapshot from 3 October 2026

The OpenSpec inventory currently reports these changes as still active or
incomplete and therefore not safe to archive automatically:

- `unify-canonical-dataflow-and-scoring` — one task remains.
- `consolidate-race-evidence-providers` — provider consolidation is incomplete.
- `adopt-durable-digest-delivery` — release delivery work is incomplete.
- `add-admin-codex-resolution-workflow` — planning is present but implementation
  has not started.

Completed changes were treated as release-history candidates rather than
deleted. They were archived only after their tasks and strict validation were
complete, keeping the archive operation reversible and avoiding unfinished
provider or deployment work.

On 3 October 2026 the completed admin/input/season/race-review changes and the
shared admin-design-system/repository-hygiene change were archived as
`2026-10-03-*` release-history entries after their tasks and strict validation
were complete. Two older race-review changes had already contributed their
requirements to the main specs, so they were archived with spec syncing skipped
to avoid applying the same requirement twice. The four entries above remain the
only active/incomplete work and are intentionally not archived.

## Worktree and temporary-file policy

- Managed worktrees are removed only through the Codex worktree lifecycle so
  uncommitted work remains recoverable.
- Probe scripts, generated previews, and local reports are disposable only when
  they are not referenced by a task, test, deployment, or backup procedure.
- Local untracked files outside the implementation worktree are user-owned
  until explicitly classified; this change does not delete them.

## Release hygiene gate

Before a cleanup commit, verify:

1. `git status --short --branch` is understood and unrelated changes are not staged.
2. `openspec validate <change> --type change --strict` passes for each archived change.
3. `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.
4. The preview and production health endpoints still report PostgreSQL.
5. The rollback image, database backups, and audit history remain available.
