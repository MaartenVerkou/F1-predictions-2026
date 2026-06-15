#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

compose_files_raw="${DEPLOY_COMPOSE_FILES:-docker-compose.yml}"
health_url="${DEPLOY_HEALTH_URL:-http://127.0.0.1:3000/healthz}"
health_retries="${DEPLOY_HEALTH_RETRIES:-40}"
health_sleep_seconds="${DEPLOY_HEALTH_SLEEP_SECONDS:-3}"

IFS=':' read -r -a compose_files <<< "$compose_files_raw"
compose_args=()
for compose_file in "${compose_files[@]}"; do
  if [[ -z "$compose_file" ]]; then
    continue
  fi
  if [[ ! -f "$compose_file" ]]; then
    echo "Missing compose file: $compose_file" >&2
    exit 1
  fi
  compose_args+=(-f "$compose_file")
done

if [[ "${#compose_args[@]}" -eq 0 ]]; then
  compose_args=(-f docker-compose.yml)
fi

health_probe() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$health_url" >/dev/null
    return
  fi
  wget -q -O - "$health_url" >/dev/null
}

docker compose "${compose_args[@]}" config -q
docker compose "${compose_args[@]}" up -d --build --no-deps app

for ((attempt = 1; attempt <= health_retries; attempt += 1)); do
  if health_probe; then
    echo "Deploy healthy via $health_url"
    exit 0
  fi
  sleep "$health_sleep_seconds"
done

container_id="$(docker compose "${compose_args[@]}" ps -q app || true)"
if [[ -n "$container_id" ]]; then
  docker logs --tail 120 "$container_id" || true
else
  docker compose "${compose_args[@]}" ps || true
fi

echo "Deploy health check failed for $health_url" >&2
exit 1
