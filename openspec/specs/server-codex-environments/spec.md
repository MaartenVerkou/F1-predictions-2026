# server-codex-environments Specification

## Purpose
Define how the MHV production server provides per-app Codex CLI environments without giving Codex unrestricted access to the whole server or live deployment checkouts.

## Requirements
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

### Requirement: Codex environments use registered app slugs
App-scoped Codex environments SHALL align with the app registry so Codex work can be traced to the correct app, repository, preview hostnames, and deploy path.

#### Scenario: Codex environment is provisioned for a registered app
- **GIVEN** an app registry entry has slug `wok`
- **WHEN** a Codex environment is provisioned for that app
- **THEN** the environment SHALL use a dedicated Unix user for that app
- **AND** it SHALL use a dedicated Codex home under `/srv/codex/<app>/home` or a documented compatibility path
- **AND** it SHALL use worktrees under `/srv/codex/<app>/worktrees` or a documented compatibility path
- **AND** it SHALL NOT reuse another app's Codex home

#### Scenario: Compatibility Codex path exists
- **GIVEN** an existing app uses an older Codex path such as `/srv/codex/f1`
- **WHEN** the app is registered under a newer public slug such as `wok`
- **THEN** the registry SHALL record the compatibility path
- **AND** future automation SHALL use the registry rather than assuming the public slug and filesystem path are identical

### Requirement: Codex preview work stays separate from production deployment
Codex-assisted changes SHALL create candidate worktrees and preview environments without directly mutating production checkouts.

#### Scenario: Codex prepares a preview candidate
- **GIVEN** Codex is processing a registered app run
- **WHEN** it creates or modifies code
- **THEN** the changes SHALL be made in a dedicated worktree
- **AND** preview deployment SHALL use an isolated preview environment
- **AND** the live production checkout SHALL remain owned by production deployment automation

#### Scenario: Codex run requests production deploy
- **GIVEN** a Codex run has produced a candidate change
- **WHEN** production deployment is requested
- **THEN** deployment SHALL use the registered production deployment path
- **AND** Codex SHALL NOT directly write into the live production checkout as the deploy mechanism
