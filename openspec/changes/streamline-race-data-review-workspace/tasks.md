## 1. Review lifecycle and route context

- [x] 1.1 Expose the latest actual snapshot review status for the selected Race Data round and render pending/reviewed metadata beside the primary evidence.
- [x] 1.2 Reuse the protected actual-snapshot review/publish operation from Race Data with a validated local return path that preserves season, round, table view, and derivation focus.
- [x] 1.3 Keep question focus optional for primary evidence review and ensure correction revisions remain pending until explicitly reviewed.

## 2. Compact identities and derivation controls

- [x] 2.1 Add shared presentation-only three-letter driver and constructor codes with full names retained in title/ARIA metadata and canonical ids preserved in correction forms.
- [x] 2.2 Apply compact identity cells and responsive widths to the evidence and championship tables without changing shared row/cell structure or ordering.
- [x] 2.3 Shorten derivation question labels to numbered compact text while retaining the complete prompt in accessible metadata and preserving progressive selection behavior.

## 3. Verification and preview

- [x] 3.1 Add unit/template coverage for code formatting, optional focus, review-state rendering, safe return paths, and compact question labels.
- [x] 3.2 Add browser coverage for the pending review action/context, selecting a compact row, opening its protected editor, and the narrow-table CSS contract.
- [x] 3.3 Run focused/full tests, strict OpenSpec validation, rebuild both preview routes without replacing preview state, and review the final diff before committing.
