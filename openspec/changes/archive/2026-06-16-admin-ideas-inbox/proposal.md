## Why

Admins currently have no lightweight place inside the app to capture potential future questions or product ideas. Keeping those ideas in chat, notes, or memory makes it easy to lose context before next season planning.

## What Changes

- Add an admin-only Ideas page that behaves like a simple operational todo list.
- Allow admins to create idea entries with a type, title, optional notes, and an initial open status.
- Allow admins to mark entries as resolved, ignored, or open again without deleting historical rows.
- Show open ideas first, with enough context to review older resolved or ignored ideas.
- Seed the first next-year question idea: "Voorspel de totale hoeveelheid time penalties die in het seizoen uitgedeeld worden."

## Capabilities

### New Capabilities
- `admin-ideas-inbox`: Admins can capture and triage future question and feature ideas inside the app.

### Modified Capabilities
- `admin-interface`: Admin navigation SHALL include the new admin ideas surface using the existing responsive admin layout conventions.

## Impact

- Adds database persistence for admin idea entries.
- Adds admin routes, view, navigation, locale strings, and focused tests.
- No public user-facing behavior or scoring behavior changes.
