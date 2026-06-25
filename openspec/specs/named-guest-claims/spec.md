# named-guest-claims Specification

## Purpose
Define the lifecycle for Named Guests: recovery setup, claiming an existing Named Guest, conversion into a Registered Member, conflict resolution, and owner/admin-assisted recovery.

## Requirements
### Requirement: Named Guests can create a Guest Recovery Secret
The system SHALL let each new Named Guest create a private Guest Recovery Secret for self-service return from a fresh browser, while allowing the guest to skip self-recovery and rely on owner/admin recovery.

Feature: Named Guest claims

Rule: A new Named Guest SHALL choose whether to set guest recovery before joining a group as a Named Guest.

#### Scenario: New Named Guest chooses default Recovery PIN
- **GIVEN** a visitor has opened a valid group invite
- **AND** any required group password has been accepted
- **WHEN** the visitor chooses to join as a new Named Guest and uses the default Recovery PIN mode
- **THEN** the system SHALL require a valid Recovery PIN
- **AND** it SHALL store only a hashed representation of the Guest Recovery Secret
- **AND** it SHALL add the Named Guest to the group roster

#### Scenario: New Named Guest chooses recovery question
- **GIVEN** a visitor is joining as a new Named Guest
- **WHEN** the visitor switches to recovery-question mode
- **THEN** the system SHALL prefill an F1-themed prompt
- **AND** it SHALL allow the visitor to edit the prompt
- **AND** it SHALL require a private answer
- **AND** it SHALL store only a hashed representation of the answer

#### Scenario: New Named Guest skips self-recovery
- **GIVEN** a visitor is joining as a new Named Guest
- **WHEN** the visitor chooses no guest recovery
- **THEN** the system SHALL add the Named Guest to the group roster
- **AND** it SHALL allow the guest to continue in the current browser session
- **AND** it SHALL reject fresh-browser self-claim for that Named Guest
- **AND** it SHALL direct the person to owner/admin recovery help

#### Scenario: Existing legacy Named Guest without Guest Recovery Secret migrates before continuing
- **GIVEN** an existing Named Guest does not have a Guest Recovery Secret
- **AND** the current session or legacy resume credential proves access to that Named Guest
- **WHEN** the guest attempts to continue
- **THEN** the system SHALL require the guest to set guest recovery before editing predictions or converting to an account

### Requirement: Group access enables Named Guest selection but not control
The system SHALL let people with valid group access select a Named Guest to claim while preventing access to protected guest controls until the claim succeeds.

Feature: Named Guest claims

Rule: Invite and group password access SHALL reveal enough participant information to select a Named Guest, but SHALL NOT prove control of that Named Guest.

#### Scenario: Private group participant picker is gated by group password
- **GIVEN** a private group has a valid invite link
- **WHEN** a visitor opens the invite without a valid group password
- **THEN** the system SHALL NOT show the Named Guest picker
- **AND** it SHALL require the group password before participant names are shown

#### Scenario: Accessible group shows participant picker before claim
- **GIVEN** a visitor has valid access to an invited group
- **WHEN** the visitor needs to return as an existing Named Guest
- **THEN** the system SHALL show selectable Named Guests for that group
- **AND** it SHALL not show prediction details or edit controls before a successful Named Guest Claim

#### Scenario: Display name alone cannot claim a Named Guest
- **GIVEN** a group contains an existing Named Guest
- **WHEN** a visitor selects that Named Guest without entering the correct Guest Recovery Secret
- **THEN** the system SHALL reject the claim
- **AND** the Named Guest's predictions SHALL remain unchanged

### Requirement: Named Guest Claim proves control
The system SHALL grant control of a Named Guest from a fresh browser only after the claimant selects the Named Guest within an accessible group and provides the matching Guest Recovery Secret.

Feature: Named Guest claims

Rule: A Named Guest Claim SHALL require selecting a Named Guest within an accessible group and entering the matching Guest Recovery Secret.

#### Scenario: Successful claim resumes Named Guest
- **GIVEN** a visitor has access to a group containing a Named Guest
- **WHEN** the visitor selects that Named Guest and enters the correct Guest Recovery Secret
- **THEN** the system SHALL grant control of the Named Guest for the session
- **AND** saved predictions SHALL update the existing Named Guest rather than creating a duplicate participant

#### Scenario: Guest Recovery Secret is shared across the Named Guest identity
- **GIVEN** a Named Guest belongs to multiple friend groups
- **WHEN** the person successfully claims the Named Guest from one accessible group
- **THEN** the system SHALL treat the claim as control of that Named Guest identity across all groups tied to it

#### Scenario: Shared device requires explicit identity choice
- **GIVEN** a browser session already controls one Named Guest
- **WHEN** another person opens a group invite on the same browser
- **THEN** the system SHALL offer an explicit choice to continue as the current Named Guest or join as someone else
- **AND** it SHALL NOT silently attach the new group to the existing Named Guest

### Requirement: Guest Conversion consumes the Named Guest
The system SHALL transfer a claimed Named Guest into a Registered Member as a whole temporary identity and then remove the separate Named Guest participant.

Feature: Named Guest claims

Rule: Guest Conversion SHALL transfer all of a Named Guest's memberships and predictions into a Registered Member and remove the Named Guest as a separate participant.

#### Scenario: Claimed guest creates account and converts
- **GIVEN** a person has successfully claimed a Named Guest
- **WHEN** they create and verify a Registered Member account
- **THEN** the system SHALL offer Guest Conversion
- **AND** successful conversion SHALL move all memberships and predictions tied to that Named Guest into the Registered Member
- **AND** the Named Guest SHALL no longer appear separately in group rosters or leaderboards

#### Scenario: Claimed guest logs into existing account and converts
- **GIVEN** a person has successfully claimed a Named Guest
- **WHEN** they log into an existing Registered Member account
- **THEN** the system SHALL offer Guest Conversion into that account
- **AND** successful conversion SHALL remove the Named Guest participant after transfer

#### Scenario: Conversion remains available after predictions close
- **GIVEN** predictions are closed
- **AND** a person has successfully claimed a Named Guest
- **WHEN** they convert the Named Guest into a Registered Member
- **THEN** the system SHALL allow the identity transfer
- **AND** it SHALL NOT allow prediction edits beyond the normal closed-prediction rules

### Requirement: Conversion resolves prediction conflicts explicitly
The system SHALL resolve conversion conflicts separately for Group Predictions and Global League Predictions before overwriting any Registered Member predictions.

Feature: Named Guest claims

Rule: Guest Conversion SHALL make Group Predictions and Global League Predictions conflict decisions explicit before overwriting existing Registered Member predictions.

#### Scenario: Group Prediction conflict requires a choice
- **GIVEN** a Named Guest and the target Registered Member both have predictions in the same friend group
- **WHEN** Guest Conversion is reviewed
- **THEN** the system SHALL show a conflict for that group
- **AND** it SHALL let the person choose whether to keep the Registered Member's Group Predictions or use the Named Guest's Group Predictions

#### Scenario: Global League Prediction conflict requires a choice
- **GIVEN** a Named Guest and the target Registered Member both have Global League Predictions
- **WHEN** Guest Conversion is reviewed
- **THEN** the system SHALL show a Global League conflict
- **AND** it SHALL let the person choose whether to keep the Registered Member's Global League Predictions or use the Named Guest's Global League Predictions

#### Scenario: Global and group copy direction is explicit
- **GIVEN** conversion involves a friend group and Global League Predictions
- **WHEN** the system offers to couple or copy predictions
- **THEN** each option SHALL state whether predictions are copied from Global League into the group, copied from the group into Global League, or kept separate

### Requirement: Owner and admin recovery uses email confirmation
The system SHALL let group owners and admins initiate Named Guest recovery only through email-confirmed transfer or guest recovery reset flows.

Feature: Named Guest claims

Rule: Group owner/admin recovery SHALL use single-use email-token confirmation and SHALL NOT expose Guest Recovery Secrets.

#### Scenario: Owner proposes transfer to account email
- **GIVEN** a group owner manages a group containing a Named Guest
- **WHEN** the owner proposes transferring that Named Guest to an email address
- **THEN** the system SHALL send a single-use confirmation link to that email address
- **AND** it SHALL NOT transfer the Named Guest until the recipient explicitly confirms on the confirmation page

#### Scenario: Transfer confirmation consumes Named Guest
- **GIVEN** a transfer confirmation link is valid
- **WHEN** the recipient confirms the transfer
- **THEN** the system SHALL apply Guest Conversion into the target Registered Member
- **AND** it SHALL remove the Named Guest as a separate participant
- **AND** it SHALL reject reuse of the same confirmation link

#### Scenario: Owner proposes guest recovery reset
- **GIVEN** a group owner manages a group containing a Named Guest
- **WHEN** the owner proposes a guest recovery reset for that Named Guest
- **THEN** the system SHALL send a single-use reset link to the supplied email address
- **AND** it SHALL let the recipient set new guest recovery
- **AND** it SHALL NOT reveal the previous Guest Recovery Secret to the owner, admin, or recipient

#### Scenario: Expired recovery token is rejected
- **GIVEN** a recovery confirmation link is expired or already used
- **WHEN** the link is opened or submitted
- **THEN** the system SHALL reject the action
- **AND** it SHALL leave the Named Guest unchanged
