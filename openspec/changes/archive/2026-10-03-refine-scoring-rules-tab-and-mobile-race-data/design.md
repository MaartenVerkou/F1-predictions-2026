## Context

See `proposal.md` for the user-facing motivation and scope. The Inputs view already loads a season-scoped scoring-rule model and the Race Data workspace already shares identity/summary table classes across driver and constructor variants. The change must preserve those data paths and only adjust navigation, presentation metadata, and responsive sizing.

## Goals / Non-Goals

**Goals:**

- Make scoring rules a first-class, season-scoped Inputs sub-section that is opt-in from the tab bar.
- Keep the existing scoring-rule model and seasonal differences authoritative; do not duplicate rules into view-specific data.
- Present the cumulative championship-results metric as the concise `Results` option while retaining an accessible explanation.
- Reduce mobile identity and summary widths through shared responsive table variables/classes so the same rules apply to driver and constructor tables.
- Preserve bounded table scrolling, canonical labels/tooltips, sorting, selection, and all scoring/derivation behavior.

**Non-Goals:**

- No scoring formula changes, database migrations, provider changes, or new external dependencies.
- No removal of the existing Points metric or season selector.
- No redesign of the full admin shell or desktop table semantics.

## Decisions

1. **Use an Inputs sub-tab rather than a global panel.**
   The route will accept a `scoring` tab alongside `drivers`, `teams`, and `races`. The template will render the existing scoring overview only for that tab, keeping the same season context and avoiding duplicated rule summaries. A separate page was rejected because the data belongs to Inputs and the navigation already provides a natural sibling location.

2. **Keep metric identity stable and change only its presentation label.**
   The registry key used by links, URLs, derivations, and tests remains `points`. Its visible label becomes `Results`, with an accessible description/title such as “Cumulative championship results”. The derived per-round metric retains the visible label `Points`, so existing deep links and calculations remain compatible.

3. **Centralize compact table sizing in the shared race-data table styles.**
   Existing identity, facts, and summary classes will expose responsive width variables and use the same mobile media rule for drivers and constructors. Full names remain the default; compact labels are selected at the existing breakpoint, while the bounded facts region continues to own horizontal scrolling. One-off markup or per-focus width hacks are explicitly avoided.

4. **Validate behavior at the route and viewport boundaries.**
   Add route/template assertions that scoring rules are absent from non-scoring tabs and present in the scoring tab, registry assertions for `Results`, and a browser smoke check at a phone viewport for document overflow and compact identity/summary columns. This verifies the user-visible contract without coupling tests to implementation details.

## Risks / Trade-offs

- [Risk] A scoring tab link or route allow-list could be missed, making the new tab inaccessible → update the shared tab list and route validation together, with focused route tests.
- [Risk] Reducing identity widths could make long names harder to scan → retain full accessible labels/tooltips and stable compact codes, and only apply reductions below the mobile breakpoint.
- [Risk] Existing deep links/tests may expect the old visible metric label → preserve the `points` key and add an explicit accessible description while updating only visible text assertions.
- [Risk] The scoring overview could accidentally render twice during tab transitions → gate the section on the resolved tab value and assert non-scoring responses do not contain its heading.

## Migration Plan

1. Add the tab/route and presentation changes, then run focused and full automated tests.
2. Rebuild the isolated preview with the branch commit and verify desktop plus 390px viewport behavior.
3. If the layout is not usable, revert the presentation commit; scoring data and stored evidence remain untouched.
4. Production is not changed by this work.
