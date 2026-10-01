## Context

The Race Data page already reads the latest persisted evidence revision for a selected round. Full-table corrections are written as immutable `admin_correction` revisions and the existing backfill runner can fetch OpenF1 sessions, build canonical evidence, derive actuals, and leave snapshots pending review. The missing piece is a bounded invocation that refreshes only the selected round without replaying or replacing unrelated rounds.

## Goals / Non-Goals

**Goals:**

- Expose one explicit, protected refresh action beside the selected-round editing controls.
- Reuse the existing OpenF1 normalization, canonical catalog mapping, scoring, destructor preservation, evidence storage, and derivation code paths.
- Keep the refresh unit exactly one season/round and retain all previous revisions for audit and rollback.
- Make source refreshes reviewable but not automatically publishable.
- Keep the operation observable through the existing admin event logger and concise result/error feedback.

**Non-Goals:**

- No new upstream provider, scraper, schema table, or destructive replacement operation.
- No automatic conflict resolver between a source refresh and a manual correction.
- No change to the public scoring projection until an admin reviews and publishes the resulting snapshot.

## Decisions

1. **Add a `round` mode to the canonical backfill runner.** The runner already owns the complete source-to-evidence-to-derivation pipeline. Add a mutually exclusive selected-round argument and filter the completed round list to that round after fetching sessions up to its cutoff. This avoids duplicating provider normalization in the route and prevents a full season replay from overwriting other rounds. The alternative—a route-local OpenF1 client—would create a second source path and make future provider fixes diverge.

2. **Invoke the runner through the existing auto-update wrapper.** The admin route will call `runActualsAutoUpdate` with the selected season and round, the configured database/data paths, and apply mode. This preserves the deployment's database configuration and child-process isolation. The alternative of opening a second database connection inside the request would duplicate schema/bootstrap logic and increase lock risk.

3. **Append revisions, never update the selected evidence.** The selected refresh gets a unique sync/import id and is saved with the default provider revision kind. Existing `findRaceDataSnapshot`/revision listing behavior will therefore make it the selected latest revision while keeping the manual correction and prior provider rows available. The write operation is transactional; failed fetches or validation happen before the new revision is committed.

4. **Use existing pending snapshot semantics.** The runner's `upsertSnapshotForRound` writes the derived actual snapshot with `REVIEW_STATUS_PENDING`, and the route will not call `markSnapshotReviewed` or `publishActualSnapshot`. This keeps live scoring stable until the admin uses the existing review action. The alternative of publishing immediately would defeat the purpose of checking whether the source correction fixed the displayed data.

5. **Keep refresh separate from edit mode.** The template renders a compact secondary `Refresh source` form next to `Edit data`, with a confirmation prompt and hidden season/round/view/focus/return context. The client editor hides the refresh control while editing so an admin cannot accidentally discard an in-progress correction while starting a network refresh. No second table or modal is introduced.

6. **Treat errors as no-op feedback.** The route validates season, round, confirmation, and a persisted target before invoking the runner. On failure it redirects to the same context with an error message, logs the sanitized failure, and relies on the runner's import failure handling; no partial evidence revision is selected or published.

## Risks / Trade-offs

- **[Risk]** The provider fetch still requests season meetings/sessions through the selected cutoff, so a refresh is not one HTTP request. → Keep the database write limited to one round and use the provider's existing rate limiting/retries; the UI remains a single-round action.
- **[Risk]** A new provider revision can supersede a useful manual correction in the default latest view. → Preserve every revision, show the pending review state immediately, and require explicit review/publish before scoring changes.
- **[Risk]** A long upstream request can outlive a browser request. → Reuse the existing child-process runner and return a clear failure if it exits non-zero; do not stream partial results into the database.
- **[Risk]** Archived-season refreshes are historical mutations. → Require the explicit refresh confirmation, record the admin event, and keep the action append-only so rollback is a revision selection rather than data deletion.

## Migration Plan

1. Deploy the runner argument, route, template, and focused tests together.
2. Refresh one known round in preview and verify a new provider revision, pending actual snapshot, unchanged prior revision, and unchanged published values.
3. If rollback is needed, remove the route/UI change and deploy the prior commit; stored revisions remain intact and no schema rollback is required.

## Open Questions

None. The existing provider, review, and revision contracts are sufficient for the selected-round behavior.
