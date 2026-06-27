## ADDED Requirements

### Requirement: Codex work does not deploy by direct production mutation
Codex-assisted F1 changes SHALL be prepared in isolated worktrees and deployed through the existing production deployment path.

#### Scenario: Codex prepares an F1 change
- **GIVEN** Codex modifies F1 code on the production server
- **WHEN** the change is ready for review
- **THEN** the change SHALL exist in a dedicated Git worktree or branch
- **AND** production deployment SHALL still run through the established GitHub Actions/server deploy workflow
- **AND** Codex SHALL NOT directly mutate the live production checkout as the normal change path
