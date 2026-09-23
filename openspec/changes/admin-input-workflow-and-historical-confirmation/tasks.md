## 1. Contract and policy tests

- [x] 1.1 Add the historical-admin-edits and admin-interface delta specs and validate the change strictly.
- [ ] 1.2 Add route-level lifecycle tests covering archived Inputs mutations with and without explicit confirmation.
- [x] 1.3 Add view-model tests for archived policy state, unresolved mapping count, and primary navigation capabilities.

## 2. Server mutation consistency

- [x] 2.1 Centralize the request-level historical/preparation flag extraction and apply it to every Inputs mutation boundary.
- [x] 2.2 Remove unconditional historical bypasses from compatibility assignment/lineup routes while preserving domain-level affected-round validation.
- [x] 2.3 Include the historical-correction context in relevant audit events and preserve clear redirect feedback.

## 3. Shared historical confirmation UI

- [x] 3.1 Add the season policy banner and one accessible reusable confirmation dialog to the Inputs page.
- [x] 3.2 Mark Inputs mutation forms and team-order actions with a shared confirmation contract and submit the flag only after confirmation.
- [x] 3.3 Keep pending line-up edits, CSRF protection, cancellation behavior, and non-JavaScript server rejection intact.

## 4. Simplify Inputs information architecture

- [x] 4.1 Make Drivers, Teams, and Races the primary tabs and preserve selected-season links.
- [x] 4.2 Move Assignments to a read-only advanced history workflow linked from Teams without exposing raw IDs as normal controls.
- [x] 4.3 Make Mappings a conditional Data quality queue with an unresolved/conflict count and a clear fully-matched empty state.
- [x] 4.4 Keep resolved mapping and assignment records available to imports, audit, and direct compatibility links.

## 5. Verification and preview

- [x] 5.1 Run syntax, focused tests, and the full Node 22 test suite; validate OpenSpec strictly.
- [x] 5.2 Rebuild the sanitized preview from the exact feature commit and verify `/healthz` reports PostgreSQL.
- [x] 5.3 Verify archived 2025 cancellation/confirmation and active 2026 lineup/mapping flows in the preview browser; leave production unchanged.
