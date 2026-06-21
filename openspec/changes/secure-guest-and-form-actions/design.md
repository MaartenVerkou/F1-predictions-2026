## Context

The current Express app stores identity in server-side sessions and persists prediction data in SQLite. Public invite links support both authenticated members and named guests. The audit found three request-boundary risks: returning named guests can be resumed by display name alone, selected invite GET routes create authenticated group memberships, and browser POST forms do not share CSRF protection or throttling.

## Goals / Non-Goals

**Goals:**
- Prevent named guest answer takeover on public groups.
- Make GET invite routes read-only and require explicit POST for membership creation.
- Add shared CSRF protection for browser-originated state changes.
- Add low-friction throttling to sensitive authentication and password-style endpoints.
- Cover the new behavior with focused tests.

**Non-Goals:**
- Rework the whole authentication system.
- Replace Express sessions or SQLite.
- Refactor all duplicated scoring logic in this change.
- Fully harden CSP or remove all inline scripts.

## Decisions

1. Use a guest resume token stored hashed in the named guest profile.
   - Rationale: the existing guest id is effectively an internal identifier and is stored in the session. A separate token lets a guest resume across sessions without exposing the primary guest id.
   - Alternative considered: require only group password plus display name. That still lets any group member impersonate another guest.

2. Keep invite GET routes read-only and redirect authenticated non-members to an explicit join confirmation.
   - Rationale: GET routes must not create memberships or copy prediction data. Existing POST `/join/:code` already represents the explicit join action.
   - Alternative considered: silently keep GET auto-join for convenience. That preserves the audit finding and makes CSRF/user-intent boundaries weaker.

3. Implement CSRF using a lightweight first-party session token helper.
   - Rationale: the app already uses server-side sessions and EJS forms. A session-bound token can be exposed through `res.locals` and validated for unsafe HTTP methods without adding a larger framework.
   - Alternative considered: add third-party CSRF middleware. That is viable, but a local helper is small and avoids dependency churn.

4. Implement in-memory throttles for sensitive endpoints.
   - Rationale: the app is currently single-process and SQLite-backed; in-memory throttles reduce brute-force exposure without schema changes.
   - Alternative considered: persistent throttle storage. Better for multi-instance deployment, but not required by the current deployment model.

## Risks / Trade-offs

- Existing named guests created before this change do not have a resume token. -> They can continue only from the current session; admins can advise affected guests to submit as new guest if they lost the session.
- In-memory throttles reset on process restart and do not coordinate across multiple app instances. -> Keep limits conservative and document that distributed deployment would need shared storage.
- CSRF enforcement can break custom fetch submissions. -> Add the token to shared page locals and update existing same-origin fetch helpers to submit it.
- Moving GET auto-join to POST changes convenience behavior. -> Use a confirmation page for authenticated non-members and keep explicit POST join intact.

## Migration Plan

1. Add nullable resume token hash columns to `named_guest_profiles`.
2. Generate a resume token when a new named guest is created.
3. Accept returning guest access only with a matching token, or from an already authorized current session.
4. Add CSRF token rendering to forms and same-origin fetch posts.
5. Add throttles to sensitive endpoints.
6. Run unit/integration tests and Playwright coverage for affected flows.
