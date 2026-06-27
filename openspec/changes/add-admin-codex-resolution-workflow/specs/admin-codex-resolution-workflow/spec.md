## ADDED Requirements

### Requirement: Admins can request Codex resolution runs
The system SHALL allow authenticated admins to request a Codex resolution run from an idea or reported problem using structured inputs rather than arbitrary shell commands.

#### Scenario: Admin starts an investigation run from an idea
- **GIVEN** an authenticated admin is viewing an open idea
- **WHEN** the admin requests an investigation run with a non-empty objective
- **THEN** the system SHALL create a resolution run linked to that idea
- **AND** the run SHALL be queued with type `investigate`
- **AND** the page SHALL show the run as pending or queued

#### Scenario: Admin starts a fix attempt with expected scope
- **GIVEN** an authenticated admin is viewing an idea or problem report
- **WHEN** the admin requests a fix attempt with objective, expected scope, and notes
- **THEN** the system SHALL create a resolution run with type `attempt_fix`
- **AND** the run SHALL store the submitted structured fields for audit

#### Scenario: Admin captures and starts in one flow
- **GIVEN** an authenticated admin has a new reported problem or idea
- **WHEN** the admin submits it with the "save and try with Codex" action
- **THEN** the system SHALL create the idea and a linked resolution run
- **AND** the admin SHALL be redirected to the new run detail page
- **AND** the run detail page SHALL show the current state and next expected step

#### Scenario: Non-admin cannot request a run
- **GIVEN** a visitor or non-admin user submits a resolution-run request
- **WHEN** the request is handled
- **THEN** the system SHALL deny access using the existing admin access controls
- **AND** no resolution run SHALL be created

### Requirement: Resolution runs are auditable
The system SHALL track each resolution run through durable status, events, runner metadata, and sanitized logs.

#### Scenario: Runner accepts a queued run
- **GIVEN** a queued resolution run exists
- **WHEN** the runner starts processing it
- **THEN** the run status SHALL change to `running`
- **AND** the run SHALL record the branch name, worktree path, runner identity, current phase, heartbeat time, and start time

#### Scenario: Runner records completion summary
- **GIVEN** a resolution run is running
- **WHEN** the runner finishes successfully
- **THEN** the run status SHALL change to `needs_review`
- **AND** the run SHALL record a Codex summary, changed-files summary, and completion time

#### Scenario: Runner failure is visible
- **GIVEN** a resolution run is running
- **WHEN** the runner fails or times out
- **THEN** the run status SHALL change to `failed`
- **AND** the admin UI SHALL show the failure reason and last sanitized log lines

#### Scenario: Running run shows current progress
- **GIVEN** a resolution run is queued or running
- **WHEN** an authenticated admin opens the run detail page
- **THEN** the page SHALL show the admin-facing phase label, last activity time, and current runner phase
- **AND** the page SHALL indicate whether the runner is actively working, waiting, or stale

#### Scenario: Run list highlights work needing attention
- **GIVEN** resolution runs exist in queued, running, failed, needs-review, ready-to-test, and scheduled states
- **WHEN** an authenticated admin opens the resolution-run list
- **THEN** the list SHALL group or filter runs so work needing admin attention is visible without opening every run
- **AND** each row SHALL show the latest status and last activity time

### Requirement: Admins can review and iterate on Codex output
The system SHALL provide a run detail view where admins can review output, request follow-up iterations, cancel work, or reject a run.

#### Scenario: Admin reviews a completed run
- **GIVEN** a resolution run has status `needs_review`
- **WHEN** an authenticated admin opens the run detail page
- **THEN** the page SHALL show the linked idea, objective, status timeline, Codex summary, changed files, validation state, and available next actions

#### Scenario: Admin sees safe CLI takeover details
- **GIVEN** a resolution run has a branch and worktree
- **WHEN** an authenticated admin opens the run detail page
- **THEN** the page SHALL show the branch and worktree path
- **AND** the page SHALL show a copyable CLI command for a trusted operator to continue the run manually
- **AND** the command SHALL target only the app-scoped Codex worktree

#### Scenario: Admin requests an iteration
- **GIVEN** a resolution run has status `needs_review` or `failed`
- **WHEN** an admin submits follow-up instructions
- **THEN** the system SHALL append an iteration event to the same run
- **AND** the run SHALL return to a queued or running status without losing prior events

#### Scenario: Admin rejects a run
- **GIVEN** a resolution run exists
- **WHEN** an admin rejects the run with a reason
- **THEN** the run status SHALL change to `rejected`
- **AND** the rejection reason SHALL be visible in the run timeline

### Requirement: Preview environments support validation
The system SHALL provide admin-only preview access for eligible resolution runs using production-like data without writing to the live production database.

#### Scenario: Preview starts for a candidate run
- **GIVEN** a resolution run has generated a code candidate
- **WHEN** the preview build succeeds
- **THEN** the run SHALL record a preview URL
- **AND** the preview SHALL use a database snapshot or clone instead of the live production database
- **AND** the preview URL SHALL be reachable by admins over HTTPS without SSH access
- **AND** the preview URL SHALL use a first-level MHV hostname such as `wok-preview-<run-id>.mhvmade.com`
- **AND** the run detail page SHALL show that the candidate is ready to test only when required validation checks have passed

#### Scenario: Preview is restricted to admins
- **GIVEN** a preview URL exists for a resolution run
- **WHEN** a visitor or non-admin requests the preview
- **THEN** the system SHALL deny access
- **AND** the preview SHALL remain available to authenticated admins

#### Scenario: Admin opens ready-to-test candidate
- **GIVEN** a resolution run has a passing validation checklist and an admin-only preview URL
- **WHEN** an authenticated admin opens the run detail page
- **THEN** the page SHALL show a prominent ready-to-test state
- **AND** the page SHALL show the preview URL, validation checklist, changed-files summary, and test notes
- **AND** deployment approval actions SHALL remain separate from the preview test action

#### Scenario: Preview does not require local development setup
- **GIVEN** a resolution run has a ready-to-test preview
- **WHEN** an authenticated admin opens the preview link from a normal browser
- **THEN** the preview SHALL load from the MHV server
- **AND** the admin SHALL NOT need to run the app locally or open a localhost URL

### Requirement: Validated runs can become deploy candidates
The system SHALL allow admins to mark a resolution run as a deploy candidate only after required validation checks are recorded.

#### Scenario: Admin marks a validated run as deploy candidate
- **GIVEN** a resolution run has passing required validation checks and an available preview
- **WHEN** an admin marks the run as a deploy candidate
- **THEN** the system SHALL create or update a deploy candidate linked to the run
- **AND** the candidate SHALL record the branch or commit ref to deploy

#### Scenario: Invalid run cannot become deploy candidate
- **GIVEN** a resolution run has failing or missing required validation checks
- **WHEN** an admin attempts to mark it as a deploy candidate
- **THEN** the system SHALL reject the action
- **AND** the run SHALL remain in its current review state
