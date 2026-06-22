# Codex Workflow Cheat Sheet

Use plain language. Codex should infer the right workflow; exact command names are optional.

## What to Say

| Your intent | Say this | Codex workflow |
|---|---|---|
| Big new feature or app idea | "Help me shape this feature before building." | grill-with-docs then /opsx:propose |
| Clear feature, ready to plan | "Create an OpenSpec proposal for this." | /opsx:propose |
| Implement an approved OpenSpec change | "Apply the current OpenSpec change." | /opsx:apply |
| Finish and preserve a completed change | "Archive this OpenSpec change." | /opsx:archive |
| Bug, regression, failing flow | "Diagnose this bug." | diagnose |
| Feature with important behavior | "Build this test-first." | tdd |
| Small UI polish | "Make this UI update and verify it in browser." | Direct Codex edit plus browser/Playwright check when useful |
| Data-backed UI needing Docker parity | "Test this locally like production before deploy." | Start `scripts/start-production-parity.ps1`, verify in browser/Playwright, then stop it |
| Backend/data quality improvement | "Inspect the data flow and propose the safest fix." | Explore code, then OpenSpec if non-trivial |
| Unsure what process to use | "Choose the right workflow for this request." | Codex chooses from this table |

## Default Production Loop

clarify -> propose -> implement -> test -> verify -> archive

For small edits, skip the full loop and make the change directly.

## Tool Rules

- Use OpenSpec for non-trivial product, feature, architecture, or data-model changes.
- Use grill-with-docs when requirements, terminology, or domain boundaries are unclear.
- Use tdd when behavior can be specified with a useful failing test.
- Use diagnose when something is broken, slow, flaky, or regressed.
- Use Playwright for critical web flows and user-visible UI behavior.
- Use the production-parity script for final local Docker checks; stop it when review is done.
- Use GitHub Actions as the baseline production verification.
