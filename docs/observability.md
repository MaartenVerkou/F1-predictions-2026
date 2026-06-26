# Observability

Default production goal: make failures diagnosable later without guessing.

## Minimum Logging

- Use structured logs for backend/server events when the app has a server.
- Include request id, route/action, user/workspace id when safe, status, duration, and error name.
- Do not log secrets, tokens, cookies, full payment details, or raw personal data.
- Use LOG_LEVEL from the environment.

This app emits JSON logs for:

- `server_started`
- `http_request`
- `unhandled_server_error`
- `health_check_failed`
- `actuals_auto_update_started`
- `actuals_auto_update_succeeded`
- `actuals_auto_update_failed`
- `admin_actuals_auto_update_run`
- `admin_actuals_auto_update_failed`

Every HTTP response includes `X-Request-Id`. Incoming `X-Request-Id` values are reused when they are short and header-safe; otherwise the app generates a UUID.

## Error Tracking

Use Sentry or an equivalent error tracker when the app is deployed.

Expected environment variables:

- SENTRY_DSN
- SENTRY_ENVIRONMENT
- SENTRY_TRACES_SAMPLE_RATE

## Health Checks

For deployed apps, add a cheap health endpoint or smoke-check route that confirms the app boots and can reach critical dependencies.

Current endpoint: `GET /healthz`

It verifies the process is running and the active database backend can answer a trivial query. Docker, CI smoke checks, and the production deploy workflow use this endpoint.

## Audit Logs

Add audit logs when the app has accounts, permissions, billing, admin actions, destructive actions, or sensitive data.

## Backups

The server uses host-level Restic backups to Cloudflare R2. Cron and credentials live outside the repo:

- `/etc/cron.d/mhv-backup`
- `/usr/local/sbin/mhv-backup`
- `/usr/local/sbin/mhv-backup-prune`
- `/etc/mhv-backup.env`
- `/var/log/mhv-backup.log`

Central PostgreSQL dumps are created under `/srv/infra/postgres/backups` before
the encrypted host-level backup captures central backup outputs.
