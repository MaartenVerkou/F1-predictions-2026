## Context

The existing race-data evidence pipeline already stores provider payloads in
`race_data_imports` and `race_data_snapshots`, and the actuals derivation reads
reviewed persisted evidence.  The Destructors Championship is different from
the standard F1 feeds: it is a community-maintained estimate published after a
race, normally by one Reddit author, and the server cannot reliably call the
Formula1 Dashboard endpoint directly. The machine-readable Formula 1 Dashboard
Destructors API is retained as an explicit transport fallback: it attributes
the same community estimates to the Reddit author and is stored as separate
provenance. See `proposal.md` and the destructors-import
delta spec for the motivation and externally visible requirements.

The implementation must therefore add a source adapter and a small source
ledger without making the request path poll Reddit or allowing an incomplete
community estimate to overwrite reviewed actuals.

## Goals / Non-Goals

**Goals:**

- Discover posts from a configured Reddit RSS feed with bounded retries and a
  deterministic author/title/season/round match.
- Provide a server-friendly Formula 1 Dashboard API mirror path when Reddit
  rejects the deployment egress address, without treating it as official F1
  data or hiding the canonical source URL.
- Preserve the original post metadata and body as immutable provenance while
  storing normalized damage facts for the existing evidence/derivation path.
- Make repeated jobs safe: the same Reddit post cannot create duplicate facts
  or revisions.
- Keep imports pending until an admin can inspect the source, unresolved rows,
  and the resulting actuals diff.
- Reuse the existing snapshot review, audit, and rollback lifecycle and make
  the one-shot importer suitable for cron/systemd or a preview job.

**Non-Goals:**

- No OCR or screenshot interpretation in the first version.
- No attempt to bypass Reddit, Cloudflare, or a provider's access controls.
- No replacement of the canonical Jolpica/Formula1 result feeds.
- No automatic publication of actuals and no production scheduler or data
  mutation as part of this change.

## Decisions

### 1. RSS discovery with a narrow provider contract

Implement a `reddit_destructors` provider module with an injectable fetcher,
plus a bounded Formula 1 Dashboard API adapter for environments where the
Reddit feed is blocked. The API adapter is explicitly selected by the import
command, keeps the API's canonical URL, and records that the estimates are
attributed to `u/Dense-Strategy-867`.
The default feed is configured through environment variables and defaults to a
subreddit RSS URL filtered to the known author/title pattern.  The adapter
normalizes Atom/RSS entries into a candidate containing post id, URL, author,
title, timestamps, HTML/text body, and image links.  Matching is explicit:
  author, season, and a recognizable Grand Prix/round title must all be
  present.  A post that does not match is recorded as a skipped candidate,
  not guessed into a race.

Retries are limited to timeouts, 408/425/429 and 5xx responses.  Respect
`Retry-After` when present and otherwise use bounded exponential backoff.  The
job exits with a useful missing/rate-limited status instead of silently
clearing data.  Conditional `ETag`/`Last-Modified` requests are supported when
the source ledger has them.

**Alternative considered:** searching Reddit's JSON API or crawling arbitrary
pages.  That is less reliable, more likely to trigger access controls, and
would make provenance non-deterministic.

The Formula 1 Dashboard API fallback uses the direct endpoint first and an
explicitly configured HTTPS transport proxy only after a server-side challenge.
The proxy changes transport, not source attribution; the imported payload keeps
the canonical API URL and remains pending review.

### 2. Text-first parsing and explicit unresolved facts

Parse the post body for the author's structured damage list and normalize
driver codes against the season roster.  Preserve the original component text,
driver/team identifiers, parser version, and parse warnings.  A component or
cost that cannot be resolved remains `unresolved`; it is never converted to
zero and never silently attached to another driver/team.

The normalized rows are stored under the existing evidence payload's
`external.damage` shape so the actuals derivation has one source of truth.  If
the post only contains a chart image, store the image URL and an incomplete
status for manual review rather than introducing OCR guesses.  F1 Top App may
be used as a visible cross-check later, but is not a canonical input.

**Alternative considered:** OCR by default.  OCR can be added behind an
explicit adapter later, but it is too error-prone for point-bearing facts and
would obscure the original evidence.

### 3. Append-only source ledger and idempotent persistence

Add a `destructors_source_posts` table keyed by `(provider, post_id)` with raw
content, source URL, author/title, publication/fetch metadata, content hash,
parser version, round, parse status, unresolved details, and last error.  The
table is additive and included in both SQLite and PostgreSQL schema creation.

On import, upsert the source ledger by post id/content hash, then create at
most one `race_data_imports`/snapshot revision for that source post.  Existing
race evidence for the same round is preserved and the Destructors section is
merged; results, qualifying, standings, and other providers are not replaced.
Retries after a partial failure can safely resume because each write is
transactional and source-post identity is unique.

### 4. Reuse the reviewed snapshot gate

The importer creates a pending evidence revision and exposes its provenance
and normalized diff through the existing admin review flow.  It does not call
`markSnapshotReviewed`, publish actuals, or alter scoring.  Only a complete,
admin-reviewed revision may be consumed by the existing actuals derivation.
Rejecting or rolling back the revision leaves the previous reviewed snapshot
active.  This keeps the Reddit estimate at the same trust boundary as other
external evidence.

### 5. Derive from persisted evidence, not provider memory

Extend `buildPersistedDataFromEvidence` to expose Destructors rows from
`payload.external.damage`.  The existing `serializedActualsForRound` and
`topDamageEntities` logic then operates on the same persisted data used by the
preview/admin pages and by scoring.  This avoids a second code path in which a
fresh fetch can disagree with a reviewed snapshot.

### 6. One-shot job with external scheduling

Provide `npm run destructors:import` for one bounded import pass, supporting
`--season`, `--apply`/`--dry-run`, and an optional feed override.  Scheduling is
kept outside the web server: preview can run the command on demand, while the
deployment can invoke it from cron/systemd after a race and during a bounded
retry window.  No in-process timer is added, avoiding duplicate workers when
the app has multiple replicas.  The command reports discovered, imported,
skipped, unresolved, and unchanged counts for logs/monitoring.

## Risks / Trade-offs

- **[The author changes format or delays a post]** → keep raw source, expose a
  `waiting`/`parse_incomplete` status, retry on the schedule, and require
  manual completion rather than guessing.
- **[Reddit throttles or blocks the server]** → conditional requests, bounded
  backoff, a single configured RSS endpoint, and no data mutation on failure.
- **[Community estimates are corrected later]** → source posts are append-only;
  a newer post creates a new revision and prior reviewed data remains
  recoverable.
- **[Cost values are absent from text]** → preserve component evidence and
  unresolved state; do not publish a zero or infer a price catalog.
- **[Existing evidence has no Destructors section]** → create a minimal
  evidence revision marked incomplete; standard race facts remain untouched and
  the admin review page can show exactly what is missing.
- **[Schema divergence between SQLite preview and PostgreSQL production]** →
  update both schema paths and add an integration test that exercises the
  SQLite fallback plus the Postgres SQL generation/registration lists.

## Migration Plan

1. Add the provider, source ledger schema, parser, persisted-evidence mapping,
   CLI, and tests.  The new table is additive and existing rows are unchanged.
2. Deploy the code to the preview branch only and run the importer in dry-run
   mode against a known post.  Verify provenance, round matching, unresolved
   handling, and idempotent re-run.
3. Run an apply import for one completed race; inspect the pending evidence and
   actuals diff in the admin UI, then explicitly review it.  Compare the
   resulting Destructors values with the source post and the existing manual
   data.
4. If the adapter misbehaves, disable the scheduler or stop invoking the CLI;
   reviewed snapshots and existing actuals remain untouched.  Rollback is a
   code deploy rollback plus, if necessary, rejection of the pending revision;
   no destructive table/data operation is required.
5. Only after preview acceptance should a future release add a production
 schedule. This change itself does not enable a production schedule; it does
 make the server-friendly API mirror available for a controlled import when
 Reddit is blocked.
