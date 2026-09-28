## Why

The Race Data page has drifted into an overly compact presentation: full driver and constructor names are hidden even when there is room, the result position presentation is ambiguous, and the primary result table does not expose the session sequence that distinguishes sprint and normal weekends. The championship controls also use a different visual language from the Drivers/Constructors switch.

## What Changes

- Restore full driver and constructor names as the default presentation, with stable three-letter codes only at responsive width thresholds before the table scrolls.
- Show finish positions as plain numeric positions rather than `P1`/`P2`/`P3`.
- Build the selected-round result columns from available persisted session evidence, supporting normal and sprint weekend order and optional practice sessions without inventing empty data.
- Keep the existing race/grid/status/points facts while presenting session labels clearly (`P1`, `P2`, `P3`, sprint qualifying, sprint race, qualifying, and race as applicable).
- Remove vertical borders between the first identity columns in the result table, matching the championship table's calmer identity block.
- Give the championship content variants the same segmented control treatment as Drivers/Constructors and provide a compact, styled metric selector when the viewport cannot fit the button group.

## Capabilities

### New Capabilities

### Modified Capabilities

- `admin-race-result-review-workspace`: the evidence table becomes session-aware and preserves readable identities responsively; championship view controls share one interaction pattern.
