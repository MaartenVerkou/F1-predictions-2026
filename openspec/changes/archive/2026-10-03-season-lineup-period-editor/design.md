## Context

The existing canonical schema already stores season membership and `driver_team_assignments` with `from_round`, `to_round`, team, driver, and seat. The current `/admin/inputs` team tab projects one selected round and submits two dropdowns per team. The new behavior should change the editing surface, not introduce a second source of truth or a production-data migration.

## Goals / Non-Goals

**Goals:**

- Make the team table the clear source for maintaining a season's seat history.
- Keep interval rows normalized, validated, and usable by round-specific consumers.
- Make the common stable-lineup case one compact row per seat and the replacement case two or more explicit periods.
- Preserve canonical driver identities, admin protections, audit events, and the existing read-only diagnostic history.
- Make historical changes deliberate without blocking ordinary future roster planning.

**Non-Goals:**

- Replacing the canonical driver/team model or provider mappings.
- Editing imported race results from this page.
- Copying production data into preview or changing production deployment.
- Supporting arbitrary per-race lineup overrides as a separate UI concept.

## Decisions

### 1. Keep the existing interval schema and add a team-history command

The service will read all assignments once, group them by team and seat, and expose a pure history projection to the view. A new transactional command will validate a submitted team history against the unchanged assignments for other teams, then update/insert/delete only the selected team's rows. Existing assignment IDs are preserved when a submitted row refers to the same record; removed rows are deleted only after validation succeeds. The existing round-specific command remains as a compatibility path for any downstream caller, but is removed from the normal team UI.

### 2. Use one compact team table plus an inline editor row

The table will have Team, Seat 1, Seat 2, and Active columns. Seat cells render period chips with driver name and `Rfrom–Rto/present`. Selecting a team and choosing Edit reveals one editor row directly below it. Each seat editor contains period rows with a canonical-driver select, start round, optional end round, add-period, and remove controls. This keeps the overview readable while making the period model explicit only when editing.

### 3. Submit one team at a time

Each expanded editor owns one form containing the complete history for that team. This limits accidental cross-team edits and lets the server apply a small transaction. The form uses repeated seat-specific fields (`seat_1_*[]`, `seat_2_*[]`) and a hidden team/season identity; the server normalizes blanks and validates the complete final set before any write.

### 4. Treat open-ended periods as `NULL` end rounds

The last period is displayed as `present` and is submitted with an empty end-round value. Numeric bounds remain inclusive. The service rejects `to_round < from_round`, duplicate/overlapping intervals, and overlapping driver occupancy across all teams.

### 5. Reuse the existing historical-correction guard

The save command computes the earliest round affected by the diff and checks imported evidence/reviewed actuals using the existing review-state query. If the change touches protected history, the first request returns the existing warning state and the second request must include the explicit confirmation field. Future-only changes are saved directly.

### 6. Keep the diagnostic assignment tab read-only

The assignments tab remains useful for support and data audits, but it no longer competes with the team editor as an editing route. It may be relabeled as History in the UI while retaining its current normalized rows and source metadata where that helps diagnostics.

### 7. Prefer server-rendered period rows with small progressive enhancement

The server renders all existing periods and the canonical driver options. A focused client-side controller only clones a period template, removes an unsaved row, and toggles the inline editor. Without JavaScript, existing periods remain visible and the server form remains usable for edits to rendered rows.

## Risks / Trade-offs

- **Replacing rows can affect external references to assignment IDs** → preserve IDs for rows that remain and verify the schema has no foreign keys requiring assignment IDs to be stable; downstream reads use driver/team identities and intervals.
- **A large team history could make the row tall** → keep period rows compact, collapse editors by default, and show the read-only overview first.
- **A missing season driver could block a replacement** → keep the existing canonical driver creation/membership flow and link to it from the editor when no suitable driver exists.
- **Historical confirmation can be missed on a stale form** → recompute the guard inside the transaction boundary and never trust only the rendered warning.

## Migration Plan

1. Add the pure team-history projection and transactional save helper with unit tests.
2. Add the team table/inline editor route and localized labels while keeping the compatibility round route.
3. Update focused browser/request tests and verify replacement, removal, overlap, and historical-confirmation behavior.
4. Refresh the sanitized preview from the remote worktree, run release checks, and inspect the preview manually.
5. Do not merge/deploy production until the user explicitly approves the preview.
