## Why

The app currently allows several high-impact state changes through weak request boundaries: named guests can be resumed by display name alone, some invite GET routes create memberships, and POST forms lack a shared CSRF guard. These are structural safety issues worth fixing before broader public use.

## What Changes

- Require a private resume token for returning named guests instead of allowing name-only takeover.
- Keep invite viewing as a read-only GET flow and move authenticated membership creation to explicit POST actions.
- Add app-wide CSRF protection for browser form submissions and same-origin fetch posts.
- Add targeted throttling for authentication, verification, password reset, and group/guest password attempts.
- Add behavior tests for the security-sensitive paths.

## Capabilities

### New Capabilities
- `guest-participant-access`: Covers named guest creation, returning guest access, and protection against unauthorized guest answer takeover.
- `form-action-security`: Covers state-changing request boundaries, CSRF enforcement, and throttling for sensitive form actions.

### Modified Capabilities
- `admin-interface`: Admin POST actions must participate in the shared form action protection.

## Impact

- Affected code: `server.js`, `src/routes/auth.js`, `src/routes/admin.js`, shared views/partials, browser fetch helpers, and tests.
- Dependencies may gain small security middleware for CSRF and request throttling if the current stack lacks suitable primitives.
- Existing public invite links remain valid, but returning guest access changes behavior by requiring the guest's resume token or current session.
