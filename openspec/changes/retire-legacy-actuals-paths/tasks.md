## 1. Plan and guardrails

- [x] 1.1 Verify repository references and confirm the legacy autofill route/helpers have no callers outside the Actuals page.
- [x] 1.2 Commit the proposal, delta spec, design, and task artifacts before implementation.

## 2. Remove the duplicate path

- [x] 2.1 Remove the legacy Actuals autofill endpoint and its provider-fetch/parser helpers from the admin route.
- [x] 2.2 Remove the legacy autofill form action and unused locale labels while keeping canonical sync/review controls.
- [x] 2.3 Add or update focused tests proving the old action is absent and existing review/publication behavior remains available.

## 3. Verify and preview

- [ ] 3.1 Run syntax checks, focused tests, full tests, build checks, and strict OpenSpec validation.
- [ ] 3.2 Rebuild the isolated preview in place without deleting its PostgreSQL state; verify health and the Actuals review flow.
- [ ] 3.3 Review the final diff for accidental data/schema changes and document production as unchanged.
