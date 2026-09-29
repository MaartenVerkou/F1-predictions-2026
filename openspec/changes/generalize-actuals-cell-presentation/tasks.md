## 1. Shared answer projection

- [x] 1.1 Add public behavior tests for scalar values, structured `value + entities` answers, duplicate entities, long entity collections, overflow counts, and unsupported fallback values.
- [x] 1.2 Replace the parallel Actuals formatting paths with one bounded projection that returns full text, compact display text, semantic kind, and overflow metadata without question-ID branches.
- [x] 1.3 Update the Actuals overview model tests and callers so stored answer values and links remain unchanged while only the display projection changes.

## 2. Unified Actuals markup and responsive styles

- [x] 2.1 Add a failing layout regression for compact code wrapping, status wrapping, two-line bounds, and shared normal/compact width variables.
- [x] 2.2 Render one visible value block per Actuals cell and preserve complete values in title and ARIA labels.
- [x] 2.3 Replace competing Actuals width and whitespace rules with shared normal/compact variables, fluid compact widths, and one common wrapping/clamping policy.
- [x] 2.4 Remove obsolete line-array and `nowrap` presentation paths after the new projection is green.

## 3. Cross-viewport verification and cleanup

- [x] 3.1 Add Playwright coverage at 390px, 600px, 720px, and 1440px for cell overflow, row alignment, question labels, review statuses, local table scrolling, and console/page errors.
- [x] 3.2 Run targeted and full test suites, compare pre/post canonical Actuals values, and validate the OpenSpec change strictly.
- [x] 3.3 Rebuild the isolated sanitized preview, verify PostgreSQL health and the Actuals page at the representative widths, and leave production unchanged.
