## Context

The current implementation already persists normalized provider evidence in `race_data_snapshots` and derives question values into season-scoped Actuals snapshots. The Race Data route still builds a focus-specific matrix as its primary surface, while Actuals and older route helpers contain overlapping transformations. See the proposal and delta specs for the required behavior.

The implementation must run against the isolated PostgreSQL preview first. Participant response tables, guest claims, published historical snapshots, and production must remain untouched until parity checks pass.

## Goals / Non-Goals

**Goals:**

- Establish one shared evidence read model and metric registry for the race-result, driver-championship, and constructor-championship tables.
- Make finish order the stable primary view and make metric/question views explicit secondary projections.
- Add revisioned, admin-only evidence corrections with a clear audit trail and no in-place mutation of published evidence.
- Derive Actuals and scoring from a selected evidence revision while retaining review and publication boundaries.
- Replace duplicated focus-driven table markup and route-level transformations with reusable read-model and table components.

**Non-Goals:**

- Editing participant answers or changing the response/guest-response schema.
- Letting admins alter provider history without an audit record.
- Replacing the existing provider import adapters in this change.
- Removing historical evidence, actual snapshots, or published scoring data during the first rollout.

## Decisions

### 1. Persist evidence, derive views

`race_data_snapshots` remains the factual boundary. A shared race-data read model loads one selected season/round snapshot and exposes normalized rows for race results, championship standings, qualifying, sprint, and optional external evidence. The primary race-result view sorts by official finish order. Metric modes are metadata-driven functions over that same model; they never write to evidence and are not separate tables.

The alternative—keeping a separate stored table for every focus question—would duplicate facts and make corrections inconsistent, so it is rejected.

### 2. Use revisioned corrections instead of in-place edits

Provider snapshots remain immutable. A protected admin correction creates a new `race_data_snapshots` revision containing the corrected normalized payload and a link to the superseded snapshot, editor, timestamp, reason, and correction type. Additive nullable metadata columns are preferred over a second correction-only fact table so the evidence remains one navigable history. A correction uses a new sync/revision identity and is marked as an admin-originated/reconstructed source.

The correction endpoint validates season membership, round ownership, canonical driver/team IDs, allowed statuses, and metric-specific invariants. It requires CSRF, admin authorization, explicit confirmation, and a non-empty reason. It never updates participant response rows or rewrites an existing snapshot.

### 3. Separate three UI layers

The Race Data page has one shared shell:

1. a compact Season and Round toolbar;
2. a fact section with the finish-order race table, followed by driver and constructor championship tables;
3. a derivation-review section with a question selector that activates the appropriate metric mode and links the evidence rows to the derived answer.

The driver/constructor toggle and metric controls are rendered from a reusable control group. They appear as compact segmented buttons when space permits and collapse into an accessible select at narrow widths. The question selector is intentionally below the factual tables so a question cannot accidentally redefine the primary race-result view.

### 4. Keep Actuals as a publication read model, not a fact source

The derivation service accepts a season catalog revision, evidence snapshot revision, cutoff round, and question definition. It produces a canonical value plus provenance/unavailable state. Actuals stores the review/publish revision and optional correction metadata; it does not become a second race-fact source. The Actuals page becomes a compact question-by-round matrix, with a link into the Race Data derivation review for the selected cell.

Until parity is proven, existing Actuals snapshots remain readable and publishable. The global legacy `actuals` projection is not removed in this change; its retirement follows the separate cleanup plan after the new path is verified.

### 5. Use a metric registry, not question conditionals in templates

Metric modes are defined in one server-side registry with a stable key, supported entity view, label, value renderer, total/sort rule, unavailable behavior, and optional row/column emphasis. Question metadata references a metric key. UI templates only render the selected read model and do not contain question-specific derivation branches.

### 6. Verify vertically before broad cleanup

Implement and test one complete path first: finish-order facts → podium metric → question derivation → Actuals cell → scoring. Then add points, DNFs, qualifying, sprint, and destructors modes using the same registry. Remove old focus-driven markup only after all supported modes have parity tests.

## Risks / Trade-offs

- **[Risk]** A correction changes a value already used by published scoring. → Create a new evidence/derivation revision and keep the previous publication active until review and explicit publish.
- **[Risk]** Provider rows cannot be resolved to canonical IDs. → Keep the row unresolved, show it in the audit state, and block affected derivation instead of guessing.
- **[Risk]** The new shared table changes existing totals or ordering. → Compare every supported metric by season/round against the current preview before switching the default UI.
- **[Risk]** A large page becomes slow with all three table sections. → Load one selected round snapshot, memoize metric projections, and keep the UI server-rendered with compact payloads.
- **[Risk]** Narrow screens hide the metric controls. → Use a semantic segmented control with a select fallback and test phone-width layout.
- **[Trade-off]** Revision metadata adds columns and storage. → It removes duplicate factual tables and makes corrections/reproducibility explicit.

## Migration Plan

1. Add additive evidence-revision metadata and metric/read-model contracts; backfill nullable metadata without rewriting payloads.
2. Implement the shared read model and metric registry behind the existing Race Data route, with feature-equivalent output tests.
3. Add protected correction endpoint/UI and verify that a correction creates a new revision while participant answers and published snapshots remain unchanged.
4. Move the Race Data page to the stable fact/metric/derivation layout and add the question-by-round Actuals overview.
5. Route derivation and scoring through the selected evidence revision; compare old/new actual values and leaderboard points for the sanitized preview.
6. Remove superseded focus markup and route-level duplicate transformations only after parity, full tests, build checks, and Playwright checks pass.
7. Rebuild the isolated preview in place without resetting PostgreSQL. Production remains unchanged until explicit approval. Rollback is the previous app image plus the prior published snapshot pointer; no destructive migration is required for the first rollout.

## Open Questions

- The exact set of editable evidence fields can be finalized from the provider-neutral payload after the first vertical correction slice; fields not safely canonicalizable remain read-only.
