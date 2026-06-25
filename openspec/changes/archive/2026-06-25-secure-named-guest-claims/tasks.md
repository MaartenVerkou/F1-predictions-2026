## 1. Data Model and Domain Helpers

- [x] 1.1 Add Guest Recovery Secret metadata and hashed secret storage for Named Guest identities.
- [x] 1.2 Add single-use hashed email-token storage for owner/admin transfer and reset proposals.
- [x] 1.3 Add helpers for Guest Recovery Secret normalization, hashing, verification, expiry, retry limits, and audit-safe logging.

## 2. Guest Join and Claim Flow

- [x] 2.1 Update first-time Named Guest join to offer guest recovery, defaulting to Recovery PIN with optional recovery-question mode.
- [x] 2.2 Add the post-invite/password participant picker for people who need to find an existing Named Guest.
- [x] 2.3 Require Named Guest Claim before returning guests can resume, edit predictions, view protected response details, or start conversion from a fresh session.
- [x] 2.4 Add migration handling so existing legacy Named Guests set guest recovery before continuing.
- [x] 2.5 Handle shared-device flows with explicit "Continue as ..." and "I'm someone else" choices.

## 3. Guest Conversion

- [x] 3.1 Add conversion entry points after successful Named Guest Claim, signup verification, and login.
- [x] 3.2 Convert all groups tied to the Named Guest into the Registered Member and remove the Named Guest participant.
- [x] 3.3 Add explicit conflict choices for each affected group's Group Predictions.
- [x] 3.4 Add explicit conflict choices for Global League Predictions and any Global/group copy direction.
- [x] 3.5 Allow conversion after prediction close without allowing prediction edits beyond normal rules.

## 4. Owner/Admin Recovery

- [x] 4.1 Add owner/admin actions for proposing Named Guest transfer and guest recovery reset.
- [x] 4.2 Send transfer/reset emails with single-use confirmation links and clear proposed-action copy.
- [x] 4.3 Add confirmation pages that require an explicit POST before transfer or reset is applied.
- [x] 4.4 Ensure owner/admins can reset or propose transfer but cannot view Guest Recovery Secrets.

## 5. Verification

- [x] 5.1 Add unit/integration tests for Guest Recovery Secret setup, verification, retry failures, and migration.
- [x] 5.2 Add tests for participant picker visibility and protected pre-claim access boundaries.
- [x] 5.3 Add tests for Guest Conversion across multiple groups, duplicate removal, and conflict choices.
- [x] 5.4 Add tests for owner/admin email-token transfer/reset confirmation and token expiry/reuse rejection.
- [x] 5.5 Run OpenSpec validation if the CLI is available, plus lint, unit tests, and targeted Playwright flows.

## 6. Join Screen Refinement

- [x] 6.1 Make the invite join screen show only username plus primary account CTA and secondary guest CTA before guest recovery is requested.
- [x] 6.2 Reveal guest recovery controls only after the visitor chooses to continue as guest.
- [x] 6.3 Allow first-time Named Guests to skip self-recovery and require owner/admin help for later fresh-browser recovery.
- [x] 6.4 Replace user-facing Claim Secret wording with Guest Recovery/Recovery PIN wording across join, reset, and recovery surfaces.
- [x] 6.5 Update focused integration/browser tests and rerun validation.
- [x] 6.6 Style the guest recovery method selector consistently and show only the selected method fields.
- [x] 6.7 Remove duplicate no-recovery helper copy and prevent skip-label overlap.
- [x] 6.8 Consolidate recovery controls onto the shared choice-tile style and keep action buttons equal-height when labels wrap.
- [x] 6.9 Move first-time guest recovery setup into a dedicated second step after the guest name is entered.
- [x] 6.10 Explain on the guest recovery step that the current device is remembered through the existing session.
- [x] 6.11 Add a real remember-this-device toggle with hover help on the guest recovery step.
- [x] 6.12 Clarify the guest recovery step title so it describes future return verification for the named guest.
- [x] 6.13 Improve guest recovery field rhythm and replace the plain Recovery PIN textbox with a dedicated PIN control.
- [x] 6.14 Use a 30-day remembered-device duration for Named Guests while keeping the default app session duration separate.
