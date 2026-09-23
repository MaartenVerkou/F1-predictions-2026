## Why

Country metadata is still displayed as two-letter values in the teams and race model, while the rest of the admin input data now follows Formula 1's three-letter presentation conventions. Race rows also expose long IANA timezone names that are technically precise but visually noisy.

## What Changes

- Standardize team base-country and race country values to three-letter F1-style uppercase codes.
- Update the 2026 seed values without changing stable IDs, driver assignments, or race schedule instants.
- Keep race country data canonical but omit the redundant country token from the compact race metadata line.
- Render the scheduled timezone as a readable date-specific UTC offset in parentheses, while retaining the exact IANA zone as hover metadata.

## Capabilities

### New Capabilities

- `f1-country-codes-and-timezone-display`: Consistent F1 country codes and concise timezone presentation for season inputs.

### Modified Capabilities

## Impact

- Country-code normalization, team/race seed data, and additive validation behavior.
- Admin inputs team/race table presentation, localized editor fields, and focused tests.
- Preview rebuild and seed only; production remains unchanged.
