#!/bin/sh
# Login shell of the deploy user (ADR-0035), installed as
# /usr/local/sbin/tracemail-deploy-gate. Tailscale SSH runs every session as
# `<login shell> -c "<command>"`, or `<login shell> -l` for an interactive
# shell. This gate accepts only `deploy <40-hex commit SHA>` and hands the SHA
# to the deploy script through the user's single sudo rule; every other
# session is refused.
set -eu

refuse() {
    echo "This account only runs deploys: deploy <commit SHA>" >&2
    exit 1
}

if [ "$#" -ne 2 ] || [ "$1" != "-c" ]; then
    refuse
fi

case "$2" in
    "deploy "*) sha=${2#deploy } ;;
    *) refuse ;;
esac

case "$sha" in
    "" | *[!0-9a-f]*) refuse ;;
esac
if [ "${#sha}" -ne 40 ]; then
    refuse
fi

exec /usr/bin/sudo --non-interactive /usr/local/sbin/tracemail-deploy "$sha"
