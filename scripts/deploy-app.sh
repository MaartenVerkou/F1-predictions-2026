#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="${F1_RELEASE_DIR:-/srv/f1-predictions/shared/releases}"
TOKEN_FILE="${GHCR_TOKEN_FILE:-/srv/mhvmade-apps/shared/secrets/ghcr-read-token}"
CURRENT_TAG="mhv-release/f1:current"
ROLLBACK_TAG="mhv-release/f1:rollback"
COMPOSE=(-f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.server.yml")

case "${APP_IMAGE:-}" in
  ghcr.io/maartenverkou/f1-predictions-2026@sha256:*) ;;
  *) echo "APP_IMAGE must be the immutable F1 GHCR digest" >&2; exit 2 ;;
esac
test -s "$TOKEN_FILE" || { echo "Missing GHCR read credential" >&2; exit 2; }
mkdir -p "$RELEASE_DIR"

previous_image="$(docker inspect f1predictions-app-1 --format '{{.Image}}' 2>/dev/null || true)"
if [[ -n "$previous_image" ]]; then
  docker image tag "$previous_image" "$ROLLBACK_TAG"
  if [[ -f "$RELEASE_DIR/f1-current.json" ]]; then
    cp "$RELEASE_DIR/f1-current.json" "$RELEASE_DIR/f1-rollback.json"
  else
    printf '{"type":"legacy-image","image_id":"%s"}\n' "$previous_image" > "$RELEASE_DIR/f1-rollback.json"
  fi
fi

docker_config="$(mktemp -d)"
trap 'rm -rf "$docker_config"' EXIT HUP INT TERM
DOCKER_CONFIG="$docker_config" docker login ghcr.io -u maartenverkou --password-stdin < "$TOKEN_FILE" >/dev/null
DOCKER_CONFIG="$docker_config" docker pull "$APP_IMAGE" >/dev/null

cd "$ROOT_DIR"
APP_IMAGE="$APP_IMAGE" docker compose "${COMPOSE[@]}" up -d --no-build --no-deps app

healthy=0
for _attempt in {1..20}; do
  container_id="$(docker compose "${COMPOSE[@]}" ps -q app)"
  container_ip="$(docker inspect "$container_id" --format '{{(index .NetworkSettings.Networks "mhv-web").IPAddress}}')"
  if curl --fail --silent "http://$container_ip:3000/healthz" | python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("status") == "ok" and d.get("databaseBackend") == "postgres" else 1)'; then
    healthy=1
    break
  fi
  sleep 3
done

if [[ "$healthy" != 1 ]]; then
  echo "F1 health/database gate failed; restoring rollback image" >&2
  if docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
    APP_IMAGE="$ROLLBACK_TAG" docker compose "${COMPOSE[@]}" up -d --no-build --no-deps app
  fi
  exit 1
fi

docker image tag "$APP_IMAGE" "$CURRENT_TAG"
printf '{"image":"%s","deployed_at":"%s"}\n' "$APP_IMAGE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RELEASE_DIR/f1-current.json"
printf 'production_health=ok\ndatabase_backend=postgres\nimage=%s\n' "$APP_IMAGE"
