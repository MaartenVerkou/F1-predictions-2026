## Why

Race Data currently makes the derivation question selector look like part of the review gate, while the canonical race result itself is the evidence that needs to be checked. The primary result table also spends too much width on repeated full names, making review difficult on normal and narrow screens.

## What Changes

- Make round review independent of selecting a question; questions remain an optional derivation-inspection tool.
- Expose the selected round's pending/reviewed state and a protected Mark reviewed action beside the primary facts, reusing the existing publish/review lifecycle.
- Keep corrections available through the existing single-row protected editor and make corrections return to the race-data workspace.
- Compact primary and championship identity cells with stable three-letter driver/team codes while retaining full names as tooltips and accessible labels.
- Shorten the derivation question selector's visible labels and constrain it responsively without losing the full question text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-race-result-review-workspace`: Review status and correction actions belong to the selected race evidence; question selection is optional and table identities remain compact but discoverable.

## Impact

The admin Race Data route, review/correction forms, shared race-result and championship table templates, compact identity formatting, styles, localization labels where needed, and unit/template/browser tests. The existing actual-snapshot review and publication lifecycle remains the source of truth; no schema or scoring changes are required.
