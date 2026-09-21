## 1. Round-aware lineup service

- [ ] 1.1 Add a public effective-round lineup projection that returns each season team and its two current seats.
- [ ] 1.2 Add an atomic lineup command that validates the complete desired lineup before splitting/replacing round-bounded assignments.
- [ ] 1.3 Handle driver swaps, duplicate-driver validation, empty seats, round 1, and historical-correction confirmation in the command.
- [ ] 1.4 Preserve the existing low-level assignment path as a compatibility wrapper over the same validation and audit behavior.

## 2. Admin workflow

- [ ] 2.1 Replace the primary Inputs assignment workflow with one team-centric lineup editor and effective-round selector.
- [ ] 2.2 Add a compact lineup save form that submits both team seats and clearly reports changed seats and validation errors.
- [ ] 2.3 Add the explicit historical-correction confirmation when the selected round has reviewed actuals or imported evidence.
- [ ] 2.4 Move raw assignment history, identity mappings, and order metadata into an advanced/secondary view.
- [ ] 2.5 Add the protected admin flow to create a canonical replacement driver and season membership without editing existing IDs.

## 3. Downstream consistency

- [ ] 3.1 Route Race data round context through the effective-round lineup projection while retaining observed source team IDs and labels.
- [ ] 3.2 Route Questions and Actuals round-specific driver/team option resolution through the same projection.
- [ ] 3.3 Add audit events and affected-round metadata for lineup changes without rewriting historical race evidence.

## 4. Verification and preview

- [ ] 4.1 Add vertical-slice tests for replacement, swap, empty seat, duplicate occupancy, round cutoff, historical confirmation, and permissions.
- [ ] 4.2 Add a sanitized preview fixture that demonstrates a mid-season replacement and verify the lineup before/after the cutoff.
- [ ] 4.3 Run lint, targeted tests, OpenSpec strict validation, and preview smoke checks for Inputs → Questions → Race data → Actuals.
- [ ] 4.4 Keep production migration/deployment pending explicit preview approval.
