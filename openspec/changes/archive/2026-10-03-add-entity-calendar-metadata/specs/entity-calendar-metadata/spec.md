## Purpose

Makes teams and races identifiable and reusable through stable codes and carefully scoped geographic and calendar metadata instead of display-name parsing.

## ADDED Requirements

### Requirement: Canonical entities expose optional metadata

The system SHALL store and return team code, team base country code, first F1 season, race code, race country code, and circuit name without changing canonical entity IDs or assignment relationships.

#### Scenario: Seeded team metadata is available
- **WHEN** a season input catalog includes a seeded team with metadata
- **THEN** the catalog returns its code, base country, and first F1 season

#### Scenario: Seeded race metadata is available
- **WHEN** a season input catalog includes a seeded race with metadata
- **THEN** the catalog returns its code, country, circuit name, and existing IANA start timezone

#### Scenario: Metadata is not known yet
- **WHEN** a team or race has no researched value for an optional field
- **THEN** the field remains empty and the entity remains usable

### Requirement: Administrators can maintain metadata through existing editors

The admin inputs row editors SHALL allow administrators to update the optional team and race metadata using the same season mutation and historical-confirmation rules as the existing entity fields.

#### Scenario: Team metadata is edited
- **WHEN** an administrator saves a team code, base country, or first F1 season
- **THEN** the canonical team metadata is updated while its ID and driver assignments remain unchanged

#### Scenario: Race metadata is edited
- **WHEN** an administrator saves a race code, country, or circuit name
- **THEN** the canonical race metadata is updated while its round, start instant, timezone, and status state remain intact

### Requirement: Metadata uses constrained canonical formats

Team and race codes SHALL be normalized to uppercase alphanumeric identifiers, country values SHALL use two-letter uppercase ISO-style codes, and first F1 season SHALL be a valid four-digit year.

#### Scenario: Invalid metadata is rejected
- **WHEN** an administrator submits a malformed code, country code, or year
- **THEN** the save is rejected with a validation error and no partial entity update is written
