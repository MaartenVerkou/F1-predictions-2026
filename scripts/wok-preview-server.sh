#!/usr/bin/env bash
set -euo pipefail

# mhv-server intentionally does not install Node on the host. Run the
# repository-owned lifecycle in the pinned Node tooling image while exposing
# only the host Docker/Git binaries and the server paths it needs.
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wok-preview.js"
case "$SCRIPT_PATH" in
  /srv/*) ;;
  *) echo "Run this helper from a checkout under /srv on mhv-server" >&2; exit 1 ;;
esac

NODE_IMAGE="${WOK_PREVIEW_NODE_IMAGE:-node:24-bookworm-slim}"

exec docker run --rm \
  -v /usr/bin/docker:/usr/bin/docker:ro \
  -v /usr/libexec/docker:/usr/libexec/docker:ro \
  -v /usr/bin/git:/usr/bin/git:ro \
  -v /usr/lib/git-core:/usr/lib/git-core:ro \
  -v /etc/ssl/certs:/etc/ssl/certs:ro \
  -v /lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu:ro \
  -v /lib64:/lib64:ro \
  -v /usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu:ro \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /srv:/srv \
  -v /var/lib:/var/lib:ro \
  "$NODE_IMAGE" node "$SCRIPT_PATH" "$@"
