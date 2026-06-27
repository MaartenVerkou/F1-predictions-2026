## ADDED Requirements

### Requirement: Web-triggered Codex runs use app-scoped runner isolation
The MHV server SHALL execute web-triggered F1 Codex runs through an app-scoped runner that preserves the existing F1 Codex isolation boundaries.

#### Scenario: Runner creates an isolated worktree
- **GIVEN** a queued F1 resolution run exists
- **WHEN** the F1 Codex runner starts the run
- **THEN** it SHALL create or reuse a worktree under `/srv/codex/f1/worktrees`
- **AND** it SHALL run as the `f1-codex` Unix user
- **AND** it SHALL NOT use `/srv/f1-predictions/current` as the editing directory

#### Scenario: Runner cannot read production secrets
- **GIVEN** the F1 Codex runner is processing a resolution run
- **WHEN** Codex or its child process attempts to read production `.env` or central infrastructure secret files
- **THEN** normal Unix permissions SHALL deny the read
- **AND** the denied secret content SHALL NOT appear in runner logs

#### Scenario: Runner receives controlled prompt input
- **GIVEN** an admin has requested a resolution run
- **WHEN** the runner invokes Codex
- **THEN** it SHALL use a server-rendered prompt file or structured input generated from the run record
- **AND** it SHALL NOT accept arbitrary shell commands from the admin UI
