## Why

The app now supports Named Guests, but the account-upgrade path needs a clearer identity model before broader use. Guests need to find themselves in a friend group weeks later, prove that they control the right Named Guest, and convert into a Registered Member without duplicate participants or ambiguous prediction overwrites.

The current narrow guest-resume model is not enough for that full lifecycle. Display-name-only recovery is too weak, and a private resume token alone does not give users a friendly claim flow, owner-assisted recovery, or explicit conflict handling between Group Predictions and Global League Predictions.

## What Changes

- Add an optional self-service Guest Recovery Secret for new Named Guests, using a Recovery PIN by default with an optional F1-themed recovery-question mode.
- Let people who have invite/password access view participant names and select the Named Guest they want to claim.
- Require a successful Named Guest Claim before resuming a Named Guest, converting it to an account, or changing its predictions from a fresh session.
- Convert all groups tied to the Named Guest into a Registered Member, then remove the Named Guest as a separate participant.
- Show explicit conflict choices for each affected group's Group Predictions and the user's Global League Predictions.
- Add owner/admin recovery flows that send single-use email confirmation links for transfer or guest recovery reset, without exposing stored secrets.
- Provide a migration path for existing Named Guests without a Guest Recovery Secret.

## Capabilities

### New Capabilities
- `named-guest-claims`: Covers Guest Recovery Secret creation, Named Guest Claim, Guest Conversion, prediction conflict decisions, and owner/admin recovery for Named Guests.

## Impact

- Affected code: `server.js`, `src/routes/auth.js`, `src/routes/admin.js`, group/join/signup/login/verify views, locales, and tests.
- Data model changes: add hashed Guest Recovery Secret storage and metadata to Named Guest identity records; add single-use email-token records for guest transfer/reset proposals.
- Security impact: Guest Recovery Secrets and recovery tokens must be stored hashed, expire, be single-use, and must not be viewable by admins.
- UX impact: first-time guest join gains one extra secret step; returning/claiming guests gain a participant picker and clearer conversion choices.
- Existing active change `secure-guest-and-form-actions` introduced a private resume-token baseline. This proposal supersedes that narrow guest-resume behavior with a user-facing Guest Recovery Secret and conversion lifecycle.
