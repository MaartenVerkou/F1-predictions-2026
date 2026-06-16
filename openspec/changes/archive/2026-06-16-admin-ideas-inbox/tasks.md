## 1. Data Model

- [x] 1.1 Add `admin_ideas` table creation to database startup.
- [x] 1.2 Add idempotent seed logic for the requested next-year time-penalties question idea.
- [x] 1.3 Add model helpers or scoped SQL for listing, creating, and updating idea status.

## 2. Admin Interface

- [x] 2.1 Add admin routes for viewing ideas, creating ideas, and updating idea status.
- [x] 2.2 Add an admin ideas EJS page using existing admin page/card/action/table patterns.
- [x] 2.3 Add the Ideas item to admin navigation with active state.
- [x] 2.4 Add locale strings for English and Dutch admin idea UI, with fallback parity for other locale files.

## 3. Verification

- [x] 3.1 Add focused tests for admin-only access, seeded idea visibility, idea creation, status changes, and responsive layout.
- [x] 3.2 Run OpenSpec validation, lint, unit tests, build, and Playwright tests.
- [x] 3.3 Mark tasks complete only after implementation and verification pass.
