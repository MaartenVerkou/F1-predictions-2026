#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
KEEP_COUNT="${KEEP_COUNT:-90}"
BACKUP_PREFIX="${BACKUP_PREFIX:-f1predictions}"
COMPOSE_ARGS="${COMPOSE_ARGS:-}"

mkdir -p "$BACKUP_DIR"

# shellcheck disable=SC2086
docker compose $COMPOSE_ARGS run --rm -T \
  -e BACKUP_OUT_DIR=/backups \
  -e BACKUP_KEEP_DAYS="$KEEP_DAYS" \
  -e BACKUP_KEEP_COUNT="$KEEP_COUNT" \
  -e BACKUP_PREFIX="$BACKUP_PREFIX" \
  -v "$BACKUP_DIR:/backups" \
  app node scripts/backup-state.js
