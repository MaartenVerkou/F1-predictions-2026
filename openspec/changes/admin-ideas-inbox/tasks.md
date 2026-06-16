## 1. Data Model

- [ ] 1.1 Add `admin_ideas` table creation to database startup.
- [ ] 1.2 Add idempotent seed logic for the requested next-year time-penalties question idea.
- [ ] 1.3 Add model helpers or scoped SQL for listing, creating, and updating idea status.

## 2. Admin Interface

- [ ] 2.1 Add admin routes for viewing ideas, creating ideas, and updating idea status.
- [ ] 2.2 Add an admin ideas EJS page using existing admin page/card/action/table patterns.
- [ ] 2.3 Add the Ideas item to admin navigation with active state.
- [ ] 2.4 Add locale strings for English and Dutch admin idea UI, with fallback parity for other locale files.

## 3. Verification

- [ ] 3.1 Add focused tests for admin-only access, seeded idea visibility, idea creation, status changes, and responsive layout.
- [ ] 3.2 Run OpenSpec validation, lint, unit tests, build, and Playwright tests.
- [ ] 3.3 Mark tasks complete only after implementation and verification pass.
