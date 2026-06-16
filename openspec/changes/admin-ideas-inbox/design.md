## Context

The admin area already contains operational pages for questions, actuals, analysis, and oversight. Future question ideas and feature ideas are currently not captured in the app, so they can be lost between races or before next season planning.

## Goals / Non-Goals

**Goals:**
- Add an admin-only ideas inbox for future question and feature ideas.
- Persist ideas in the existing SQLite database with creator, status, and timestamp metadata.
- Keep the UI consistent with existing admin pages and responsive admin layout utilities.
- Seed the requested next-year question idea as an open item.

**Non-Goals:**
- Turning ideas directly into live scoring questions.
- Public voting, commenting, assignment, due dates, or notifications.
- Full project-management behavior beyond open/resolved/ignored triage.

## Decisions

- Store ideas in a new `admin_ideas` table.
  - Rationale: Ideas are operational app data, not configuration, and multiple admins need to share state.
  - Alternative considered: JSON file storage. Rejected because it complicates concurrent admin updates and backup/restore consistency compared with the existing DB.
- Use a minimal status model: `open`, `resolved`, `ignored`.
  - Rationale: It matches the requested todo-list workflow while avoiding unnecessary process states.
  - Alternative considered: adding archived/deleted/draft. Rejected until there is a concrete admin workflow for those states.
- Use server-rendered admin routes and EJS.
  - Rationale: Existing admin pages are server-rendered and already have shared layout, navigation, authentication, and test patterns.
- Seed the requested idea idempotently at startup.
  - Rationale: The requested test idea should exist without relying on one manual admin session, but seeding must not duplicate rows after restarts.

## Risks / Trade-offs

- Duplicate similar ideas may still be entered manually -> Mitigate by only idempotently seeding the requested initial idea and leaving broader duplicate detection out of scope.
- A minimal todo list can become too limited later -> Mitigate by keeping the table extensible with type, notes, creator, updater, and timestamps.
- More admin nav items can crowd small screens -> Mitigate by using the existing horizontally scrollable admin nav behavior.

## Migration Plan

1. Create the `admin_ideas` table if it does not exist.
2. Seed the requested next-year question idea with a stable seed key only if missing.
3. Deploy normally; rollback leaves an unused table that does not affect scoring or public pages.
