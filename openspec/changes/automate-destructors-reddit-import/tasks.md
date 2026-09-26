## 1. Schema and evidence contract

- [ ] 1.1 Add the `reddit_destructors` source type and additive `destructors_source_posts` schema to SQLite and PostgreSQL registration/DDL.
- [ ] 1.2 Extend evidence payload validation/build helpers so Destructors rows, raw source metadata, parser version, and unresolved warnings are preserved without changing other provider sections.
- [ ] 1.3 Extend persisted-evidence derivation to expose Destructors rows to the existing actuals serialization path.

## 2. Reddit provider and parser

- [ ] 2.1 Implement the injectable RSS/Atom provider with author/title/season/round matching, timeout handling, conditional headers, bounded retry/backoff, and explicit missing/rate-limit statuses.
- [ ] 2.2 Implement conservative text-first parsing for the author's damage list, roster mapping, component/cost normalization, image-link capture, and unresolved-fact reporting.
- [ ] 2.3 Add provider/parser unit tests for matching, HTML decoding, unknown rows, malformed content, retries, and missing-feed behavior.

## 3. Transactional import command

- [ ] 3.1 Implement an idempotent importer that stores immutable source-post provenance keyed by provider/post id and merges only the Destructors section into race evidence.
- [ ] 3.2 Ensure dry-run/apply modes, duplicate protection, transaction rollback, per-round selection, and incomplete imports never publish or overwrite reviewed actuals.
- [ ] 3.3 Add the `destructors:import` package script/CLI with concise operational counts and safe environment/argument handling.
- [ ] 3.4 Add persistence tests covering schema creation, first import, repeated import, unresolved rows, and failure-without-mutation.

## 4. Review and derivation integration

- [ ] 4.1 Connect imported evidence to the existing pending snapshot/review metadata so admins can inspect source URL, raw evidence, unresolved fields, and the actuals diff.
- [ ] 4.2 Verify reviewed Destructors values are used by actuals derivation/scoring while rejected or pending values leave the previous reviewed snapshot active.
- [ ] 4.3 Add regression tests for persisted Destructors derivation and actuals serialization, including no-zero fallback and rollback/pending behavior.

## 5. Verification and preview rollout

- [ ] 5.1 Run lint, focused unit/integration tests, full test suite, build, and strict OpenSpec validation.
- [ ] 5.2 Run a dry-run against a known Reddit post on the preview server and verify round matching, provenance, unresolved handling, and idempotent re-run.
- [ ] 5.3 Apply one preview import, review it in the admin UI, compare against the source post, and document the exact scheduler invocation without enabling production scheduling.
