## 1. Evidence editing contract

- [x] 1.1 Replace the single-row correction parser with complete-table input normalization for race and available session rows, including stable identity and duplicate/stale validation.
- [x] 1.2 Update the correction route to save one immutable revision, re-derive actuals, mark the corrected snapshot reviewed, publish it, and redirect without a success flash.
- [x] 1.3 Add focused unit coverage for complete-matrix validation, session updates, invalid values, and provenance/review state.

## 2. Race Data editing UI

- [x] 2.1 Enrich the selected-round view model with editable session values and render one shared form/table with inline inputs for all visible evidence cells.
- [x] 2.2 Replace row selection and the disabled Edit button with a compact `Edit data` action plus Save/Discard state controls.
- [x] 2.3 Update the client controller so edit mode is keyboard-accessible, discard restores the original DOM values, and successful navigation keeps the selected season/round/focus.

## 3. Review identity and layout

- [x] 3.1 Render `Reviewed by` versus `Edited by` from persisted evidence provenance with a compact reviewer/timestamp label.
- [x] 3.2 Remove redundant detail-toolbar bottom margin and align title, review action/status, and edit actions vertically using shared toolbar styles.
- [x] 3.3 Remove obsolete row-editor/selection CSS and add compact table-editor styling that works in light/dark themes and inside the existing scroll region.

## 4. Verification and handoff

- [x] 4.1 Update layout and E2E tests for the new toolbar, edit/discard flow, protected save, and reviewed/edited labels.
- [x] 4.2 Run syntax checks, targeted unit/E2E tests, OpenSpec validation, rebuild the preview, and verify the selected-round flow at desktop and phone widths.
