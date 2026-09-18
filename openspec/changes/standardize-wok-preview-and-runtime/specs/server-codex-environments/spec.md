## MODIFIED Requirements

### Requirement: Codex preview work stays separate from production deployment
Codex-assisted changes SHALL create candidate worktrees and preview environments without directly mutating production checkouts. WOK preview candidates SHALL use the public `wok` identity while preserving the existing `/srv/codex/f1` compatibility path until migration is complete.

#### Scenario: Codex prepares a preview candidate
- **GIVEN** Codex is processing a registered app run
- **WHEN** it creates or modifies code
- **THEN** the changes SHALL be made in a dedicated worktree
- **AND** preview deployment SHALL use an isolated preview environment
- **AND** the live production checkout SHALL remain owned by production deployment automation
- **AND** WOK preview metadata SHALL identify the app as `wok`

#### Scenario: Codex run requests production deploy
- **GIVEN** a Codex run has produced a candidate change
- **WHEN** production deployment is requested
- **THEN** deployment SHALL use the registered production deployment path
- **AND** Codex SHALL NOT directly write into the live production checkout as the deploy mechanism
