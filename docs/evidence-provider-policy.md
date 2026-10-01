# Evidence provider policy

Race evidence has one owner per fact family. Rendering, derivation, scoring, and
admin review read persisted evidence; they do not call external providers.

| Fact family | Canonical source | Stored scope |
| --- | --- | --- |
| Practice 1–3, sprint qualifying, sprint, qualifying, starting grid, race | OpenF1 | Session identity, rows, status, provenance, and unavailable reasons |
| Driver and constructor standings by round | Jolpica/Ergast | Standings only; never a competing session-result feed |
| Driver of the Day | Formula1.com results page | Award only |
| Destructors Championship crash-component costs | Approved Reddit importer | Separate reviewed damage evidence |

Formula 1 Dashboard is not a standard-results provider. Its historical adapter
may remain only as comparison context while old snapshots are reconciled; new
imports fail fast if it is selected for standard session evidence.

OpenF1 backfills are reconstructive: the provider fetch time and session dates
are retained, existing evidence revisions are preserved, and conflicts create a
pending revision rather than silently changing reviewed Actuals.
