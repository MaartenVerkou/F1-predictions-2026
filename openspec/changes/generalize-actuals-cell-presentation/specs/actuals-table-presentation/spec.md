## Purpose

Provide a predictable, compact, and accessible Season Actuals table that presents every answer consistently as new questions and answer shapes are added.

## ADDED Requirements

### Requirement: Actuals cells use one bounded display projection

The Season Actuals overview SHALL present every stored answer through one shared display policy that preserves the complete canonical answer while producing a bounded compact value for the table. The policy SHALL deduplicate repeated entities, use compact entity labels when a collection is long, and expose an overflow indicator when values are omitted from the visible projection.

#### Scenario: A long entity answer is displayed
- **WHEN** an Actuals cell contains more entities than fit in the compact policy
- **THEN** the visible value SHALL use compact entity labels and an overflow count
- **AND** the complete answer SHALL remain available through the cell's title and accessible label
- **AND** the presentation SHALL not branch on an individual question identifier

#### Scenario: Duplicate entities occur in a structured answer
- **WHEN** a stored answer contains the same driver or constructor more than once
- **THEN** the visible projection SHALL show that entity once
- **AND** the complete accessible value SHALL also use the canonical deduplicated interpretation

#### Scenario: A future question returns a new answer shape
- **WHEN** a new question returns a scalar, structured value, or entity collection supported by the shared answer contract
- **THEN** the Actuals table SHALL render it through the same projection and overflow policy
- **AND** no question-specific formatter or stylesheet rule SHALL be required

### Requirement: Actuals values use common wrapping and truncation

All visible Actuals values, including full names, compact codes, numbers, statuses, and overflow indicators, SHALL use the same wrapping, overflow, and bounded-line policy. A narrow cell SHALL wrap content instead of clipping an unbreakable presentation line, while the full value remains available on hover and to assistive technology.

#### Scenario: A compact code value is wider than its cell
- **WHEN** a compact code sequence does not fit on one line
- **THEN** the sequence SHALL wrap within the cell according to the shared policy
- **AND** it SHALL not create horizontal overflow inside the cell or at page level

#### Scenario: A review status is longer than the available width
- **WHEN** a race column contains a status such as “needs review”
- **THEN** the status SHALL wrap using the same value rules as answer content
- **AND** the race column SHALL remain within its configured width

### Requirement: Actuals uses two responsive presentation modes

The Actuals overview SHALL use one normal mode for wider viewports and one compact mode for narrow viewports. The compact mode SHALL reduce shared question and race/value column widths and use the short question label, but SHALL not introduce additional breakpoint-specific content rules.

#### Scenario: The overview is opened in normal mode
- **WHEN** the viewport is wider than the compact threshold
- **THEN** the full question prompt SHALL be visible
- **AND** all table values SHALL use the same shared wrapping policy

#### Scenario: The overview is opened in compact mode
- **WHEN** the viewport is at or below the compact threshold
- **THEN** the short question label MAY occupy at most two visible lines with an ellipsis
- **AND** race/value columns SHALL use the shared compact width
- **AND** the document SHALL not gain horizontal overflow outside the table's own scroll region
