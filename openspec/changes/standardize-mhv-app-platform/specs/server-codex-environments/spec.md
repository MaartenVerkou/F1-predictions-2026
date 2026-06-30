## ADDED Requirements

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
