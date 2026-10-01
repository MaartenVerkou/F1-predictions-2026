# Destructors Championship import

The Destructors Championship is a community estimate, not an official F1
feed. The importer follows the configured Reddit RSS feed for
`Dense-Strategy-867`, keeps the post and image links as evidence, and creates
pending race-data/actual revisions. It never publishes an actual or changes
scoring by itself.

## Preview / manual run

From the application container or repository checkout:

```sh
npm run destructors:import -- --season=2026
npm run destructors:import:apply -- --season=2026
```

The first command is read-only. The second stores the source post and creates a
pending evidence revision. Use the admin review workflow to inspect it and
explicitly approve it. If the post has only the author's component list and no
numeric totals, the importer records `cost_missing:*` and leaves the
Destructors actual unavailable; it does not treat the missing amount as zero.

The importer is idempotent by Reddit post id plus content hash. A revised post
creates a new evidence revision while retaining the previous source snapshot.

## Scheduling

Use a one-shot scheduler outside the web process so multiple app replicas do
not run duplicate pollers. A safe pattern is a job every 30 minutes during the
24 hours after a scheduled race, followed by one daily retry. The command
must receive the same `DATABASE_URL`, `QUESTIONS_PATH`, `ROSTER_PATH`, and
`RACES_PATH` as the app.

Example cron entry (preview only until the flow has been verified):

```cron
*/30 * * * * cd /srv/apps/wok/current && /usr/bin/docker compose run --rm -T app node scripts/import-destructors-reddit.js --apply --season=2026 >> /var/log/wok/destructors-import.log 2>&1
```

Do not enable this in production until a preview post has been reviewed and
the resulting Destructors values have been compared with the source image.
Rate limits, missing posts, malformed lists, and unresolved costs are reported
as a non-publishing status and leave the last reviewed data untouched.
