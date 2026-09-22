## 1. Metadata presentation

- [ ] 1.1 Replace the localized `F1 {year}` token with a concise `since {year}` label while preserving all existing metadata values and power-unit localization.
- [ ] 1.2 Add focused template assertions for the new team metadata wording and optional-token behavior.

## 2. Responsive input tables

- [ ] 2.1 Add shared responsive classes/markup for drivers, teams, races, and mappings so primary content and secondary metadata have explicit layout priorities.
- [ ] 2.2 Update shared admin CSS for bounded table scrolling, cell wrapping/truncation, and narrow-width action/editor behavior without document-level overflow.
- [ ] 2.3 Add focused style/template tests covering the four input tables and shared responsive rules.

## 3. Verification and preview

- [ ] 3.1 Run syntax checks, focused tests, the full test suite, and strict OpenSpec validation.
- [ ] 3.2 Rebuild and seed the isolated preview, verify metadata and all input tabs at desktop and narrow widths, confirm preview health, and confirm production health/data remain unchanged.
