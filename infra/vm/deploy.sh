#!/usr/bin/env bash
# Deploys one commit of main to the VM (ADR-0012, ADR-0035). Installed as
# /usr/local/sbin/tracemail-deploy, owned by root; the deploy user can run it
# only through sudo, with the commit SHA as its one argument.
#
# The checkout in APP_DIR moves to that commit, so the Compose file and the
# DAGs it mounts match the images, which CI tagged with the same SHA. The tag
# is written to RELEASE_ENV, which overrides the value in .env. Rollback is
# the same command with an earlier SHA of main.
set -euo pipefail

readonly APP_DIR=/opt/tracemail/app
readonly RELEASE_ENV=/opt/tracemail/release.env
# Unused images older than this are removed; a rollback pulls again.
readonly IMAGE_RETENTION=168h

sha="${1:-}"
if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "usage: tracemail-deploy <40-character commit SHA>" >&2
    exit 2
fi

cd "$APP_DIR"
git fetch --quiet origin main
if ! git merge-base --is-ancestor "$sha" origin/main 2>/dev/null; then
    echo "Commit $sha is not on main; nothing deployed." >&2
    exit 1
fi
git -c advice.detachedHead=false checkout --quiet --detach "$sha"

printf 'TRACEMAIL_IMAGE_TAG=%s\n' "$sha" > "$RELEASE_ENV"
compose=(docker compose -f infra/compose.yaml --env-file .env --env-file "$RELEASE_ENV")
"${compose[@]}" pull --quiet
"${compose[@]}" up --detach --no-build --remove-orphans --wait
docker image prune --all --force --filter "until=$IMAGE_RETENTION" > /dev/null
echo "Deployed $sha"
