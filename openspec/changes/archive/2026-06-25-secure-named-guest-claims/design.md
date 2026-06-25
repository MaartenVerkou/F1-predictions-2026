## Context

The app has three identity concepts: Visitors, Named Guests, and Registered Members. A Named Guest can appear in one or more friend groups before creating an account. The current implementation stores guest responses separately from account responses and can copy or couple predictions between friend groups and the Global League.

This change treats a Named Guest as a temporary person identity. A Guest Conversion transfers that whole identity into a Registered Member and consumes the Named Guest so group rosters and leaderboards do not show duplicates.

## Goals / Non-Goals

**Goals:**
- Make Named Guest recovery stronger than display-name-only recovery while keeping the flow approachable.
- Let returning people find their Named Guest from an accessible group's participant list.
- Let a Named Guest become a Registered Member without losing predictions or creating duplicate participants.
- Make conflicts between Group Predictions and Global League Predictions explicit.
- Give group owner/admins a recovery path that uses email-token confirmation and does not expose secrets.
- Support existing Named Guests that do not yet have a Guest Recovery Secret.

**Non-Goals:**
- Replace the existing email/password account system.
- Redesign leaderboard scoring or prediction forms beyond the claim/conversion surfaces.
- Make private group content public before group access succeeds.
- Let admins see Guest Recovery Secrets or bypass email confirmation for account transfer.
- Solve distributed rate limiting or multi-instance token storage beyond the current deployment model.

## Decisions

1. Use Guest Recovery Secret as the proof for fresh-browser Named Guest control.
   - Rationale: a Guest Recovery Secret works even when the original browser session is gone, while the UI wording "Recovery PIN" is easier to understand than "Claim Secret".
   - Default: an optional 4-6 digit Recovery PIN.
   - Optional mode: a recovery question with a prompt and answer. The prompt is prefilled from F1-themed defaults and can be edited by the guest.
   - Skip mode: a first-time Named Guest can choose no self-recovery. They can still play in the current browser, but future recovery requires owner/admin email-token help.
   - Alternative considered: keep a generated resume token only. That is technically safer than display-name-only recovery but less usable for people returning weeks later from another device.

2. Show the participant picker only after group access succeeds.
   - Rationale: invite/password access proves the person is allowed to know who is playing, but does not prove they control any specific Named Guest.
   - For private groups, the group password gates the picker. Before claim success, the page shows group identity, rules, and participants, but not response details or edit access.

3. Store Guest Recovery Secrets and recovery tokens hashed.
   - Rationale: group owners, admins, database readers, and logs should not reveal the secret.
   - The system stores the selected mode, prompt text when passphrase mode is used, normalized hash, timestamps, and retry metadata where needed.

4. Convert the entire Named Guest identity, not only the current group.
   - Rationale: a Named Guest can join multiple friend groups before creating an account. One successful claim should resolve that temporary identity everywhere.
   - Conversion moves all group memberships and guest responses for that guest id into the Registered Member, then deletes the Named Guest memberships/responses/profile.

5. Resolve Group Predictions and Global League Predictions separately.
   - Rationale: current behavior can seed or sync Global League predictions from group predictions. Conversion must not silently overwrite either side.
   - When both sides have predictions, the conversion screen offers explicit choices such as "Use Named Guest predictions for this group", "Keep my account predictions for this group", "Use Named Guest predictions for Global League", and "Keep my account predictions for Global League".
   - When Global coupling is involved, the copy direction is stated explicitly: "Copy Global League predictions into this group", "Copy this group's predictions into Global League", or "Keep them separate".

6. Use email-token confirmation for owner/admin recovery.
   - Rationale: owner/admins can help, but the target person should confirm transfer/reset through email.
   - Transfer flow: owner/admin proposes transfer to an email address, recipient opens a single-use link, reviews the Named Guest and destination account, confirms, and then chooses conflict resolution if needed.
   - Reset flow: owner/admin sends a reset link to the person, who sets new guest recovery for the Named Guest.
   - Email links open a confirmation page and do not perform the transfer/reset on GET.

## Risks / Trade-offs

- First guest join becomes slightly longer. Mitigation: default to a short PIN and make passphrase mode optional.
- Guests can forget or skip their Guest Recovery Secret. Mitigation: provide owner/admin email-token reset and transfer flows.
- Conversion can be confusing when account and guest predictions both exist. Mitigation: present conflicts per group and Global League with explicit copy direction.
- Existing legacy Named Guests lack Guest Recovery Secrets. Mitigation: when they return through a legacy resume token, require them to set guest recovery before continuing.
- Email links can be forwarded or opened by scanners. Mitigation: links open a review page, require POST confirmation, expire, and are single-use.

## Migration Plan

1. Add nullable Guest Recovery Secret fields to Named Guest identity storage.
2. Add owner/admin recovery token storage for transfer and reset proposals.
3. Keep existing Named Guests valid; require Guest Recovery Secret setup only for legacy resume-token migration, not for first-time guests who explicitly skip self-recovery.
4. If the previous private resume-token fields exist, treat them only as a migration bridge to guest recovery setup.
5. Backfill no plaintext secrets.
6. Add tests for new guest join, skipped self-recovery, existing guest migration, claim failures, conversion conflicts, and owner/admin email confirmation.
