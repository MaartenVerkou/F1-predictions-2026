## Context

The public Questions and Responses templates currently contain duplicated term-matching arrays. Four terms are broadly reusable (DNF, DNS, DSQ, and Grand Prix), while the remaining current rules are scoped to particular question IDs: initial lineup, Grand Prix podiums, Grand Prix wins, selected Grand Prix races, Mercedes-engine teams, and damage cost. The application uses PostgreSQL in deployment and SQLite-compatible test databases, has locale JSON files, and already has a shared Inputs navigation and admin mutation protection.

## Goals / Non-Goals

**Goals:**

- Make the database the source of truth for definition labels, explanations, aliases, scope, and ordering.
- Preserve current tooltip behavior during migration while making Questions and Responses use one matcher and renderer.
- Support global definitions and question-bound definitions in the same catalog.
- Provide a public definitions reference and an admin Inputs workflow with safe archival.
- Keep definition presentation independent from scoring, derivation, answers, and Race Data evidence.

**Non-Goals:**

- No season-specific definition versions in this first slice; question bindings provide the required scope and can be extended later.
- No free-form regular expressions or executable matching rules in admin data.
- No rewrite of question IDs, responses, actuals, or existing race-data snapshots.

## Decisions

### Use a hybrid catalog rather than putting definitions on Questions

Definitions live in a dedicated catalog under Inputs. A definition without a binding is global; a definition with one or more question bindings is eligible only for those questions. This avoids duplicating DNF/DNS explanations across every question while still allowing precise rules such as “podium means Grand Prix podium only” for selected questions.

Alternatives considered:

- Storing a tooltip directly on each question would duplicate shared terms and make cross-question wording drift likely.
- Keeping all terms global would highlight context-sensitive words such as “races” or “damage” where their meaning does not apply.

### Normalize catalog data into four tables

- `definition_terms`: stable `term_key`, active/archive state, order, timestamps.
- `definition_translations`: one label and explanation per term and locale, with a unique `(term_id, locale)` key.
- `definition_aliases`: one locale-aware display alias per term, normalized for case-insensitive matching.
- `definition_question_bindings`: `(term_id, question_id)` links for scoped terms.

The schema helper will use the existing PostgreSQL/SQLite-compatible migration conventions. Archiving toggles the active state and retains rows for audit and recovery; hard deletion is not exposed in the first UI.

### Match aliases safely in one shared module

`src/question-definitions.js` will load active definitions for a locale, merge the locale with the default-locale fallback, filter by global or question binding, and produce non-overlapping matches using escaped word-boundary patterns sorted longest-first. The module returns structured spans and escaped display metadata; the two public templates will no longer maintain independent term arrays or duplicate matching loops.

The renderer will preserve keyboard focus behavior and HTML escaping already used by the public tooltip components. A missing or inactive definition simply leaves the prompt as ordinary text.

### Reuse existing admin and public page patterns

Inputs receives a Definitions tab using the existing segmented navigation and compact table/editor patterns. The admin route will use the existing CSRF protection, admin authorization, and audit logging. The public `/definitions` route will use the normal locale-aware header and a two-column table. Questions will link to it; About will link to the same page instead of maintaining a second static list.

### Seed before switching the renderer

The idempotent migration will insert the current English, Dutch, French, Spanish, and German explanations and aliases, including all existing question bindings. The shared renderer will only become authoritative after the seed is present. A temporary fallback to the existing locale strings may remain during deployment recovery, but the normal path and admin edits will use the database catalog.

## Risks / Trade-offs

- **Alias collisions can highlight the wrong phrase** → use question bindings, locale-aware aliases, longest-match selection, and tests for overlapping terms.
- **An admin can write an unclear explanation** → require non-empty bounded fields, show a preview/usage scope in the editor, and retain audit history.
- **A missing translation could create an empty tooltip** → fall back to the default locale and test every supported locale.
- **Migration could duplicate seeded terms** → enforce stable keys and idempotent upserts; never reset existing data.
- **The public page and tooltips could drift** → both read the same active catalog query and shared locale resolver.

## Migration Plan

1. Add the catalog tables and idempotent seed/backfill for the current hardcoded terms and bindings.
2. Add the shared loader/matcher and route models while retaining existing output behavior.
3. Switch Questions and Responses tooltips, add `/definitions`, and replace the About definitions list with a link.
4. Add the admin Definitions tab and protected CRUD/archive/order actions.
5. Run unit, route, accessibility, and Playwright checks for public tooltips, locale fallback, admin mutations, and unchanged scoring.

Rollback is application-code based: revert the renderer/routes while leaving the additive catalog tables and audit data intact. No user answers or race-data snapshots are modified.
