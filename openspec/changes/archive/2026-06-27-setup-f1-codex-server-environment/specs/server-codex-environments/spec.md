## ADDED Requirements

### Requirement: App Codex environments are isolated by app
The MHV production server SHALL provide Codex CLI environments per app instead of sharing one unrestricted Codex home across all apps.

#### Scenario: F1 Codex environment exists
- **GIVEN** the F1 Codex environment has been provisioned
- **WHEN** an operator inspects the server layout
- **THEN** F1 SHALL have an app-scoped Codex home at `/srv/codex/f1/home`
- **AND** F1 SHALL have app-scoped worktrees under `/srv/codex/f1/worktrees`
- **AND** the F1 Codex environment SHALL run as the dedicated Unix user `f1-codex`

#### Scenario: Future app follows the same pattern
- **GIVEN** another production app needs Codex later
- **WHEN** the operator provisions that app
- **THEN** the app SHALL receive a separate Unix user
- **AND** the app SHALL receive a separate `/srv/codex/<app>/home`
- **AND** the app SHALL NOT reuse F1's Codex home or worktree directory

### Requirement: Codex editing avoids live production checkout
Codex SHALL work in dedicated app worktrees by default rather than directly editing the live production checkout.

#### Scenario: Operator starts F1 Codex work
- **GIVEN** the F1 production checkout exists at `/srv/f1-predictions/current`
- **WHEN** an operator starts a new F1 Codex task
- **THEN** the task SHALL run from a worktree under `/srv/codex/f1/worktrees`
- **AND** the live production checkout SHALL remain deploy-owned state

### Requirement: Codex credentials are app-scoped secrets
Codex authentication artifacts SHALL be scoped to the app Codex home and treated as secrets.

#### Scenario: Operator authenticates F1 Codex
- **GIVEN** the operator runs F1 Codex login
- **WHEN** Codex stores authentication state
- **THEN** the authentication state SHALL be stored under `/srv/codex/f1/home`
- **AND** the authentication state SHALL NOT be printed in logs, docs, or command output

### Requirement: Production secrets remain unavailable to Codex user
The F1 Codex user SHALL NOT have normal read access to production secret files or central infrastructure secrets.

#### Scenario: Codex user attempts to read secrets
- **GIVEN** the F1 Codex user is provisioned
- **WHEN** that user attempts to read host-managed F1 `.env` or central PostgreSQL shared `.env`
- **THEN** the read SHALL fail under normal Unix permissions
