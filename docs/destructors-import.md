# Destructors Championship import

The Destructors Championship is a community estimate, not an official F1
feed. The primary importer follows the configured Reddit RSS feed for
`Dense-Strategy-867`. When the server's egress is blocked by Reddit, the
Formula 1 Dashboard API mirror can be selected explicitly; that page attributes
the same estimates to `u/Dense-Strategy-867`. Both paths keep raw source data as
evidence and create pending race-data/actual revisions. Neither publishes an
actual or changes scoring by itself.

## Preview / manual run

From the application container or repository checkout:

```sh
npm run destructors:import -- --season=2026
npm run destructors:import:apply -- --season=2026

# Server-friendly mirror fallback (use when Reddit RSS is blocked)
npm run destructors:import:dashboard -- --season=2026
npm run destructors:import:dashboard:apply -- --season=2026
```

The first command is read-only. The second stores the source post and creates a
pending evidence revision. Use the admin review workflow to inspect it and
explicitly approve it. If the post has only the author's component list and no
numeric totals, the importer records `cost_missing:*` and leaves the
Destructors actual unavailable; it does not treat the missing amount as zero.

The Reddit importer is idempotent by Reddit post id plus content hash. The
Formula 1 Dashboard path uses a season/round/payload hash as its source-post
identity. A revised publication or API payload creates a new evidence revision
while retaining the previous source snapshot. The API mirror uses the direct
`https://api.formula1dashboard.com` endpoint first and falls back to the
configured `FORMULA1_DASHBOARD_API_PROXY_BASE_URL` when the server receives a
Cloudflare challenge. The fallback is a transport only; the evidence still
records the canonical Formula 1 Dashboard URL.

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

If Reddit RSS is blocked for the deployment, use the explicit mirror command
instead:

```cron
*/30 * * * * cd /srv/f1-predictions/current && /usr/bin/docker compose run --rm -T app node scripts/import-destructors-reddit.js --source=formula1_dashboard --apply --season=2026 >> /var/log/wok/destructors-import.log 2>&1
```

Do not enable this in production until a preview post has been reviewed and
the resulting Destructors values have been compared with the source image.
Rate limits, missing posts, malformed lists, unavailable API mirrors, and
unresolved costs are reported as a non-publishing status and leave the last
reviewed data untouched. Do not enable either schedule until one preview import
has been compared with the source and reviewed in the admin UI.
