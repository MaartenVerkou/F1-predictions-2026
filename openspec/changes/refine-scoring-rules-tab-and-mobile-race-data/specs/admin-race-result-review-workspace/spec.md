## MODIFIED Requirements

### Requirement: Compact identity presentation preserves discoverability
The primary evidence and championship tables SHALL show full canonical driver and constructor names whenever the available layout width can accommodate them. At responsive width thresholds, the identity columns SHALL switch to stable three-letter codes before the table becomes unusable; the table SHALL retain horizontal scrolling as a final fallback. The full canonical names SHALL remain available through an accessible label or tooltip. Compact presentation MUST NOT change identity, ordering, or correction targets.

#### Scenario: Admin reviews a spacious result table
- **GIVEN** the Race Data workspace is rendered at a width where the identity columns fit
- **WHEN** a driver or constructor cell is displayed
- **THEN** the visible cell SHALL show the full canonical name
- **AND** the cell SHALL retain the same canonical identity used by corrections and derivations

#### Scenario: Admin reviews a compact result table
- **GIVEN** the Race Data workspace is rendered at a width where full identity names would crowd the facts
- **WHEN** a driver or constructor cell is displayed
- **THEN** the visible identity MAY use its stable three-letter code
- **AND** the full canonical name SHALL remain discoverable on hover and to assistive technology
- **AND** selecting and correcting the row SHALL continue to target the canonical driver identity

#### Scenario: Admin reviews a compact championship table
- **GIVEN** the championship table is rendered on a phone-width viewport
- **WHEN** the identity and final summary columns are displayed
- **THEN** those columns SHALL use the smallest shared table widths that preserve readable content
- **AND** the final summary column SHALL remain visible as a distinct column
- **AND** no identity, ordering, or derived value SHALL change as a result of the compact layout
