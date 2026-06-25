## 1. Security Boundaries

- [x] 1.1 Add session CSRF token generation, validation middleware, form locals, and same-origin fetch support.
- [x] 1.2 Add targeted in-memory throttles for login, verification resend, password reset, group password, and named guest return attempts.
- [x] 1.3 Change invite GET routes so they never create memberships or copy responses.

## 2. Named Guest Access

- [x] 2.1 Add nullable hashed resume-token storage for named guest profiles.
- [x] 2.2 Generate a private resume token for new named guest joins and expose it only to the current guest session/page.
- [x] 2.3 Require the private resume token when resuming a named guest from a fresh session.

## 3. Tests and Verification

- [x] 3.1 Add tests for read-only invite GET behavior and explicit POST join behavior.
- [x] 3.2 Add tests for named guest return rejection without the private token and success with the token.
- [x] 3.3 Add tests for CSRF rejection and valid-token success on representative user/admin mutations.
- [x] 3.4 Run OpenSpec validation, lint, unit tests, and targeted Playwright checks.
