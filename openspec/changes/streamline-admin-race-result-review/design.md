## Context

The Season actuals page currently shows overlapping content: a pending-race list, a live scoring-source card, a full season timeline, and a selected-snapshot edit card. The same snapshot status and sync timestamp appear in more than one of those areas. The existing selector and snapshot persistence already support editing a specific round safely.

## Goals / Non-Goals

**Goals:**

- Turn result verification into one clear, selected-race workflow.
- Let an admin see the answer definitions that applied to the selected round alongside the generated actual values.
- Preserve the current snapshot, scoring, authorization, and CSRF semantics.

**Non-Goals:**

- Changing score calculation, sync providers, question definitions, or historical answer data.
- Introducing bulk approval or changing the live-scoring source selection rule.

## Decisions

### Make the selector the single review entry point

Show the race selector first, followed by one compact selected-snapshot line. For a pending snapshot, the line contains only the existing review action; for a reviewed snapshot, it contains the last-reviewed date. A race without a snapshot gets no instructional paragraph because the existing save action already explains that saving creates it. This keeps the operator focused on one race without repeating the selected race name or a season-wide backlog count.

### Show question context within the selected snapshot

Render the selected race's relevant question wording/answer options in the same review card as its interpreted actual values. This lets the admin validate interpretation without navigating to another admin screen. Reuse the data already loaded for actuals editing rather than adding persistence or API endpoints.

### Retain existing selected-snapshot mutations

Keep the existing save/approve routes and their CSRF protection. The UI merely provides a clearer context for the same selected snapshot, avoiding any risk of a review action targeting a different round.

## Risks / Trade-offs

- [Removing full-season detail may hide useful context] → Retain the selected race in the selector and the review action/date line; answer context remains below the divider.
- [Question context can make the card long] → Limit it to relevant score-bearing questions and use the existing responsive admin layout classes.
- [Snapshot selection could drift from form state] → Use the selector value as the single selected-round source for both displayed context and submit target.

## Migration Plan

Deploy as a presentation-layer change. Existing snapshots and review metadata require no migration. Rollback restores the previous template/styles without altering stored data.

## Open Questions

None.
