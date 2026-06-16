## ADDED Requirements

### Requirement: Dutch user-facing pages avoid mixed English UI copy
Feature: Localized interface

Rule: User-facing labels, headings, empty states, and calls to action SHALL use the active locale where locale support exists.

#### Scenario: Dutch leaderboard renders localized insight copy
- **GIVEN** a visitor or user has selected Dutch
- **WHEN** they open the global leaderboard
- **THEN** leaderboard insight headings, chart accessibility labels, selected-participant metadata, breakdown controls, empty states, and sign-in prompt SHALL be Dutch
- **AND** English UI labels such as `Strengths`, `Gaps above`, `Question breakdown`, `Race change`, and `Sign in` SHALL not appear as interface copy

#### Scenario: Dutch public navigation uses Dutch labels
- **GIVEN** a visitor or user has selected Dutch
- **WHEN** they view home, dashboard, group, join-guest, questions, responses, and about pages
- **THEN** common interface labels SHALL avoid English leftovers such as `leaderboard`, `join`, `actuals`, `invite-link`, and mojibake text where a Dutch label exists
- **AND** domain names, team names, driver names, race names, and stored user answers SHALL remain unchanged

#### Scenario: Locale files remain complete enough for changed templates
- **GIVEN** a changed template uses a locale key
- **WHEN** the English and Dutch locale files are loaded
- **THEN** each added key SHALL exist in both files
- **AND** the template SHALL not rely on hard-coded English fallback for normal UI copy
