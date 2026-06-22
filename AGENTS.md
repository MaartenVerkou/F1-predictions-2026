# Codex Project Instructions

- For non-trivial product, feature, and architecture changes, clarify first and use OpenSpec: /opsx:propose, /opsx:apply, then /opsx:archive.
- Use grill-with-docs when requirements, terminology, or domain boundaries are unclear.
- Use tdd for feature work where behavior can be tested.
- Use diagnose for bugs, regressions, and performance issues.
- For web apps, verify critical flows with Playwright before finishing.
- For production app work, consider logging, error tracking, security/access control, and deployment verification before finishing.
- For local production-parity testing, use `powershell -ExecutionPolicy Bypass -File scripts/start-production-parity.ps1`; stop it with `powershell -ExecutionPolicy Bypass -File scripts/stop-production-parity.ps1`. Do not leave Docker running after the user is done reviewing.
- If the user describes work in plain language, infer the matching workflow from docs/codex-workflow.md; do not require exact skill or slash-command names.
- Keep changes scoped, run relevant tests, and summarize verification.
