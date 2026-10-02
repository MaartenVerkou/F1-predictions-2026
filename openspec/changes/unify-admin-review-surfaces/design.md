## Context

The canonical race-evidence and scoring work is already complete. This change is a presentation and routing cleanup on top of that contract. At present Questions and Results are two modes of one legacy template, Race Data has duplicated responsive control styling, and the constructor table maps its Results label to the points projection. The change must preserve stored race snapshots, question answers, review state, and existing admin links while reducing duplicate markup and CSS.

## Goals / Non-Goals

**Goals:**

- Give Questions and Results separate, season-aware URLs and focused page responsibilities.
- Reuse one question-results table partial and one shared admin control pattern.
- Make constructor Results display race finish evidence; keep Points as the points projection.
- Make compact controls, team-input columns, and review metadata consistent across admin pages.
- Keep compatibility for `/admin/actuals` and old Questions links through redirects or equivalent query normalization.

**Non-Goals:**

- No schema or data-source migration.
- No change to scoring rules, derivation algorithms, question identifiers, or stored answer values.
- No broad visual redesign outside the affected admin surfaces.

## Decisions

### Separate route contracts, shared table projection

`GET /admin/questions` renders only question input configuration. `GET /admin/results` renders only the question-results matrix and uses the existing bounded answer projection. The old `/admin/actuals` endpoint redirects to `/admin/results` with the season query preserved. A legacy `view=results` query on `/admin/questions` redirects to the Results route; other query parameters that identify season are preserved. This removes the mode branch from the Questions template without duplicating result markup.

The existing question-results partial remains the single markup owner for result cells. A small Results page shell supplies heading, season selection, feedback, and the partial. Questions keeps its edit toolbar and table only.

### Shared compact control classes

The Drivers/Constructors segmented control, content-variant buttons, and narrow-screen content select use the same reusable admin control classes and state attributes. The select has an accessible label/title but no visible `Content` caption when it is the compact replacement. It carries season, round, view, and focus state through the existing form fields.

### Metric semantics are explicit

The constructor metric id `points` continues to mean the championship-points projection. The constructor Results control selects the normal race-result projection, so its rows contain finish positions and the shared podium/PF/FL markers just like Drivers Results. The route/model chooses the projection from the metric id rather than inferring it from the selected table alone.

### CSS ownership and responsive layout

Shared toolbar/table classes own spacing, borders, compact controls, and table scroll behavior. Questions and Results do not add page-specific copies of the Race Data toggle styles. The Teams input table gets a shared centered index-column class, a wider team-name column, and equal, slightly narrower driver columns. Existing data-specific classes remain only where they describe a real semantic column.

### Review metadata

Review metadata is formatted as reviewer plus localized calendar date. The time-of-day is intentionally omitted because the review date is the useful audit signal in this UI; the stored timestamp remains unchanged for auditability.

## Risks / Trade-offs

- [Existing bookmarks to `/admin/questions?view=results`] -> Redirect them to `/admin/results` while preserving `season`.
- [Tests or integrations render the old `admin_actuals` template directly] -> Update in-repo tests and keep `/admin/actuals` as a route-level compatibility redirect until no callers remain.
- [Metric labels and ids drift again] -> Add a model-level regression test asserting that constructor Results and Points produce different projections.
- [CSS cleanup removes a needed selector] -> Run focused markup/CSS tests and Playwright checks at desktop and compact widths before deployment.

## Migration Plan

1. Commit the OpenSpec proposal and design/spec/task artifacts.
2. Implement routes, shells, shared controls, model semantics, and tests without changing data.
3. Run focused unit tests, Playwright critical flows, build, and strict OpenSpec validation.
4. Deploy the same verified image to preview, smoke-test Questions, Results, Race Data, and Inputs, then promote it to production.
5. Roll back to the previous immutable image if route or data rendering checks fail; no database rollback is required.

## Open Questions

None for this release. Adding/removing question definitions remains a separate future workflow.
