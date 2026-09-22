## Context

See `proposal.md` for the motivation and scope. The existing code already has canonical Inputs tables, normalized race evidence, actual snapshots, canonical answer helpers, and a leaderboard model, but the boundaries are incomplete: actual derivation is duplicated in the admin route and backfill script, scoring is duplicated across routes, and the global `actuals` table is not season-scoped. The preview must remain sanitized and production PostgreSQL must remain untouched until explicit approval.

## Goals / Non-Goals

**Goals:**

- Make one season catalog/read model the upstream boundary for all pages and services.
- Make evidence immutable and provenance-rich before any derived actual is created.
- Make derivation, review, publication, and scoring deterministic and reproducible across seasons and historical lineup changes.
- Keep migrations additive, observable, and reversible while legacy values are still readable.
- Let each admin page render a focused read model from shared services instead of copying route-specific arrays.

**Non-Goals:**

- Replacing the provider or adding a second production data store.
- Redesigning the public question wording or leaderboard visual language.
- Automatically correcting ambiguous provider mappings or inventing missing race facts.
- Copying production data into public preview fixtures.

## Decisions

### 1. Introduce a season catalog service and revision

Create a shared catalog boundary over the existing canonical tables. It returns entities, memberships, assignments, aliases, provider references, season-specific metadata, and readiness diagnostics. Compute a deterministic revision from semantic input rows; display labels may change without changing entity identity, while assignment/calendar/metadata changes create a new revision. Downstream operations accept an explicit catalog revision rather than reading tables ad hoc.

The catalog owns identity and configuration; it does not own observed race facts or participant responses. This keeps Inputs authoritative without turning it into a catch-all table.

### 2. Store immutable normalized evidence before derivation

Extend evidence import identity and payload metadata so each effective bundle is keyed by season, round, source identity, payload revision, and parser version. Normalized rows carry canonical IDs where resolution is unique, preserve provider labels, and retain unresolved reasons. The importer is idempotent for equivalent normalized bundles and creates a new evidence revision when facts or parser behavior change.

Race data and Actuals use the same persisted evidence row and cutoff resolver. A missing or partial bundle is a visible coverage state, not an implicit zero.

### 3. Use one derivation engine with strategy modules

Move question-specific derivation out of `src/routes/admin.js` and `scripts/backfill-actuals-2026.js` into a shared season-aware service. Strategies receive a catalog, a cutoff, normalized evidence, and the question definition; they return a canonical value plus provenance or an explicit unavailable reason. Question IDs and 2026-only constants belong in data/configuration or strategy metadata, not route control flow. The admin sync route and backfill command become thin callers of the same service.

### 4. Make actual snapshots a review/publish lifecycle

Keep immutable derived revisions and explicit manual corrections. Add catalog/evidence/derivation revision references to snapshots and replace the global live-actual assumption with a season-scoped published pointer or equivalent season-plus-question key. The review action publishes only a reviewed snapshot for its season; a changed derivation creates a new pending revision. Existing review metadata survives equivalent re-syncs.

### 5. Centralize scoring and preserve historical reproducibility

Make `leaderboard-model` (or a single adjacent score service) the only scoring implementation. It consumes canonical response values and a selected season snapshot, and returns points plus explanation metadata. Auth, admin, leaderboard, analysis, and public views call that service. Historical snapshots retain the catalog, question-definition, and actual revisions used, so later renames or lineup changes do not rewrite history.

### 6. Treat pages as read models over the same contracts

- Inputs: canonical identities, memberships, assignments, calendar, mappings, and readiness.
- Questions: question definitions with options resolved from the selected catalog revision.
- Race data: immutable evidence, coverage, cutoff totals, and source links.
- Actuals: derived values, provenance, review/correction state, and publishability.
- Leaderboard/analysis: scoring output for the selected published snapshot.

No page may use a display label as a foreign key or silently reconstruct a provider object from another page's HTML model.

### 7. Migrate additively and gate release

Add columns/tables and dual-read compatibility first. Backfill or report resolvable legacy values without rewriting ambiguous data. Switch preview to the shared engine, compare old and new derivations, then remove duplicate route/script paths only after parity checks. Production migration and deployment remain a separate approved step.

## Risks / Trade-offs

- **[Risk]** A catalog revision can make an old derivation look different when rerun. → Store the revision on every evidence/snapshot and use it for historical reads.
- **[Risk]** Legacy labels are ambiguous across seasons or teammates. → Keep unresolved values visible, block affected derivations, and require an admin mapping.
- **[Risk]** Replacing the global `actuals` table can expose hidden consumers. → Inventory every read/write, add season-scoped compatibility reads, and compare totals before removing the old path.
- **[Risk]** Strategy extraction changes 2026 results. → Run old-vs-new comparison per round/question on the sanitized preview before activation.
- **[Risk]** Incomplete provider data is mistaken for zero. → Carry coverage and unavailable reasons through evidence, derivation, review, and scoring.
- **[Trade-off]** Revision and provenance metadata add storage and UI detail. → Keep the admin surface compact and reveal the source chain on demand; correctness takes precedence over duplicated summary text.

## Migration Plan

1. Close the remaining tests/release checks for the current Inputs, race-data audit, and historical-confirmation changes; do not archive them with unchecked behavior.
2. Add catalog readiness/revision and integration tests without changing production tables' meaning.
3. Add evidence identity/cutoff metadata and compare shared derivation output to the current route/script output on sanitized preview data.
4. Introduce the season-scoped actual publication read/write path with dual reads and an explicit rollback switch.
5. Route admin sync, backfill, Actuals, Race data, and scoring through shared services; keep legacy label reads until migration reports are clean.
6. Refresh the preview from the feature commit, run health, targeted, full, build, and critical Playwright checks, and wait for explicit preview approval.
7. Only then merge/deploy to production using the approved immutable artifact. Rollback is the previous image plus the retained compatibility columns/tables; no destructive data migration is required.
