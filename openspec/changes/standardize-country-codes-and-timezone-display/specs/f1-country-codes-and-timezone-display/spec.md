## Purpose

Keeps country metadata aligned with Formula 1's three-letter presentation codes and makes race start timezones understandable without losing exact timezone fidelity.

## ADDED Requirements

### Requirement: Country metadata uses F1 three-letter codes

Team base-country and race country fields SHALL accept, store, and return either an empty value or exactly three uppercase letters using the app's F1-style country-code convention.

#### Scenario: Seeded country codes use three letters
- **WHEN** the 2026 catalog is seeded
- **THEN** team bases and race countries are returned as three-letter codes without changing entity IDs

#### Scenario: Invalid country code is rejected
- **WHEN** an administrator submits a country value that is not empty or exactly three letters
- **THEN** the save is rejected and the entity remains unchanged

### Requirement: Race metadata remains compact and timezone-aware

The race table SHALL omit a redundant country token from the secondary race metadata line and SHALL show the scheduled start with a date-specific UTC offset in parentheses when a valid IANA timezone is available. The exact IANA timezone SHALL remain available as hover metadata.

#### Scenario: Race row shows a readable offset
- **WHEN** a race has a scheduled instant and IANA timezone
- **THEN** the table shows a local start followed by a value such as `(UTC+11)` and retains the IANA zone as a non-invasive title/hover value

#### Scenario: Missing timezone does not invent an offset
- **WHEN** a race has no valid timezone or scheduled instant
- **THEN** the table omits the offset and preserves the existing empty/start fallback behavior
