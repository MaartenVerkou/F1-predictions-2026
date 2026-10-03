## Context

The lifecycle guard already rejects archived mutations unless `historical_correction=1`, but only the team line-up history form conditionally renders that field, and it currently depends on snapshot counts. Team-order forms and most Inputs mutations have no path to provide the flag. The normalized `driver_team_assignments`, `entity_aliases`, and `entity_provider_refs` tables are already the durable source of truth and must not be removed.

The current Inputs tabs expose Drivers, Teams, Assignments, Races, and Mappings. Teams now renders the safe team-centric lineup editor, while Assignments is a derived read-only list and Mappings is a resolver queue whose useful work is only unresolved/conflicting rows.

## Goals / Non-Goals

**Goals:**

- Make archived correction confirmation consistent for every Inputs mutation.
- Keep lifecycle enforcement at the server boundary and make the browser flow clear and accessible.
- Make Teams the primary lineup editing boundary.
- Keep assignment history and mapping data available for audit and imports without cluttering the primary navigation.
- Preserve existing canonical IDs, interval history, aliases, provider references, and production data.

**Non-Goals:**

- Removing or redesigning the canonical assignment or mapping tables.
- Making Race data editable from this workflow.
- Replacing Actuals' explicit past-race unlock semantics with the Inputs confirmation dialog.
- Introducing a session-wide archived edit mode that could accidentally authorize later actions.

## Decisions

### 1. Use a reusable action-time dialog, not a persistent edit mode

Render one compact archived-season policy banner below the season selector and one reusable accessible `<dialog>` on the Inputs page. Forms and order actions opt into the dialog through a shared data contract. On confirmation, the client adds the hidden historical-correction field to that specific form and submits it; cancellation does not submit. This keeps confirmation close to the action, avoids duplicated checkboxes, and avoids a lingering session permission.

The server remains authoritative. Every season-scoped mutation calls the lifecycle guard with the submitted flag, including compatibility endpoints that are not linked from the primary UI. The dialog is never the only protection.

### 2. Keep explicit inline confirmation only for non-archived historical impact where needed

The line-up service can require confirmation when an active-season edit changes already imported or reviewed rounds. Keep that domain-level check, but expose it through the same dialog contract where the affected range is known. Do not decide permission from global snapshot counts alone; the server's affected-round review state remains authoritative.

### 3. Make Inputs navigation capability-driven

Primary tabs become Drivers, Teams, and Races. Assignment history is reachable from Teams as a read-only advanced view (and its existing direct URL can remain compatible), but it is not a generic editor. Mappings become Data quality and are shown in navigation only when unresolved or conflicting rows exist; an empty state communicates that all source identities match.

The underlying mapping read model continues to retain provider, source label/key, entity type, candidate, and status. Resolved records remain stored for future imports and audit, but are not rendered as a CRUD table.

### 4. Standardize feedback placement

Mutation errors and successes remain in the page-level shared feedback context above the summary and tabs. The confirmation dialog contains only action-specific explanation and buttons; it does not become a second persistent error panel between a toolbar and table.

### 5. Cover the policy with route and browser tests

Add a mutation matrix covering archived requests with and without confirmation for entity, team order, remove, driver creation, lineup history, assignment compatibility, alias/provider, and mapping resolution routes. Add view assertions for the archived banner/dialog and conditional Data quality navigation. Add a preview browser flow that cancels and then confirms a team-order action, verifying the server response and unchanged state after cancellation.

## Risks / Trade-offs

- **A mutation is not marked for the dialog** → keep the server guard and add route-matrix coverage for every mutation boundary.
- **A native confirmation blocks automation or gives poor context** → use an accessible page `<dialog>` with explicit Cancel and Confirm controls.
- **Data quality is hidden when an unresolved mapping appears** → compute an unresolved count in the season context and show a badge/banner whenever it is non-zero.
- **Existing deep links to Assignments break** → retain the route and render the advanced read-only view or redirect with the selected season preserved.
- **An active-season lineup edit affects reviewed rounds** → keep round-aware service validation and test affected-range confirmation separately from archived lifecycle confirmation.

## Migration Plan

1. Add the OpenSpec contract and route/view-model tests before changing the UI.
2. Centralize mutation metadata and propagate historical confirmation through every Inputs form/action.
3. Add the shared policy banner/dialog and migrate the Inputs forms and team-order controls.
4. Adjust Inputs navigation and render the advanced assignment/Data-quality states.
5. Run fast/release checks, refresh only the sanitized preview, and exercise archived 2025 plus active 2026 flows.
6. Keep production unchanged until explicit preview approval.
