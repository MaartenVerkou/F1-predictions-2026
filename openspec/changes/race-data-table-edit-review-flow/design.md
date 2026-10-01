## Context

The selected round already renders one canonical evidence payload as a finish-order table and the correction endpoint creates immutable evidence revisions. The current browser controller only selects one row and fills a small floating form for finish, grid, status, and points. Session values remain outside that correction surface, while the review line has to share the toolbar with a selection hint.

## Goals / Non-Goals

**Goals:**

- Make the selected round the unit of editing: one edit mode covers the complete visible result/session matrix.
- Reuse the existing table markup, column ordering, validation, revision persistence, and derivation pipeline.
- Keep review identity compact and unambiguous: `Reviewed by …` for provider data and `Edited by …` for an admin correction.
- Preserve the existing protected-correction requirements and audit history while making manual corrections immediately usable for scoring.
- Keep normal viewing read-only and make Save/Discard obvious in the table toolbar.

**Non-Goals:**

- No new provider or scraping behavior.
- No changes to championship calculations or question derivation rules beyond consuming the corrected evidence revision.
- No destructive deletion of evidence revisions or bypass of CSRF, season protection, or correction reasons.

## Decisions

1. **Edit the payload-backed table in place.** Render editor inputs alongside each displayed result/session value and toggle them with one `is-editing` state. This keeps the read and edit views structurally identical and avoids a second table or a row-specific popup. A separate page was rejected because it would make it harder to compare the correction with the original evidence.

2. **Submit one complete matrix.** The form sends stable row identity plus editable race and session values for the selected snapshot. The server clones the payload, validates every submitted row against the base snapshot, updates the known session collections, and rejects missing/duplicate/unknown identities. This makes partial edits impossible and prevents a stale editor from silently overwriting a newer revision.

3. **Use the existing correction revision boundary.** A successful save calls the existing immutable evidence-revision writer, then derives and publishes the corresponding actual snapshot. The corrected snapshot is marked reviewed by the editing admin; the original provider snapshot remains available in revision history.

4. **Derive status text from provenance.** The round status uses `Edited by` when the selected evidence revision is an admin correction and `Reviewed by` otherwise. Both use the reviewer name resolved from the user table and the compact local date/time formatter.

5. **Keep toolbar layout shared.** Remove the detail toolbar bottom margin, center the heading/status/edit actions with flex alignment, and let the edit action use the same compact secondary-button treatment as the championship controls. No new breakpoint-specific layout is introduced.

## Risks / Trade-offs

- **[Risk]** A complete matrix form can be large on sprint weekends. → Keep it inside the existing table scroll region, use compact inputs, and submit only the selected snapshot.
- **[Risk]** A stale form could overwrite a newer provider revision. → Require the submitted snapshot id to match the latest selected evidence id and reject unknown/duplicate row identities.
- **[Risk]** Manual edits may create invalid combinations such as a finish position with a DNS status. → Apply shared numeric/status validation and normalize empty non-classified rows before saving; show the server error without creating a revision.
- **[Risk]** Existing tests may assert the old row editor. → Replace those assertions with full-table edit-mode, discard, validation, provenance, and publish checks.
