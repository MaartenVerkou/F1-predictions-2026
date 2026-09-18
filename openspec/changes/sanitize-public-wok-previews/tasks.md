## 1. Preview data contract

- [x] 1.1 Add sanitized/clone data-mode validation to preview descriptors and metadata
- [x] 1.2 Make public route activation reject clone-mode previews and expose data mode in redacted status

## 2. Sanitized runtime

- [x] 2.1 Provision sanitized previews without production database or file-state copies
- [x] 2.2 Add deterministic preview fixture seeding after schema health
- [x] 2.3 Render isolated development-only preview auto-login and generated session settings

## 3. Verification and migration

- [x] 3.1 Add unit coverage for sanitized defaults, clone rejection, compose, and fixture behavior
- [x] 3.2 Run lint, unit tests, and Playwright verification
- [x] 3.3 Replace the existing server preview with sanitized data and activate its public hostname
- [x] 3.4 Verify public preview reachability and unchanged production health/database backend
