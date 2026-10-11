#!/usr/bin/env bash
# Tests the deploy user's restrictions (ADR-0035) on a CI runner: the login
# shell gate, the sudoers rule's syntax, and the deploy script's argument
# check. The gate runs unmodified; the deploy script it calls through sudo is
# replaced by a stub that reports its arguments, so a test passes only if the
# gate refused the session or handed exactly the SHA to the deploy path.
#
# CI only: the stub is installed over /usr/local/sbin/tracemail-deploy, which
# on the VM is the real deploy script.
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
    echo "Runs only on a GitHub Actions runner; it replaces /usr/local/sbin/tracemail-deploy." >&2
    exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly HERE
readonly GATE="$HERE/deploy-gate.sh"
readonly STUB=/usr/local/sbin/tracemail-deploy
readonly SHA=0123456789abcdef0123456789abcdef01234567
readonly REFUSAL="This account only runs deploys"

printf '#!/bin/sh\necho "deploy-called $*"\n' | sudo tee "$STUB" > /dev/null
sudo chmod 755 "$STUB"

failures=0

expect_deploy() {
    local name=$1; shift
    local out
    if out=$(sh "$GATE" "$@" 2>&1) && [[ "$out" == "deploy-called $SHA" ]]; then
        echo "ok      $name"
    else
        echo "FAILED  $name: expected a deploy of $SHA, got: $out"
        failures=$((failures + 1))
    fi
}

expect_refusal() {
    local name=$1; shift
    local out
    if ! out=$(sh "$GATE" "$@" 2>&1) && [[ "$out" == *"$REFUSAL"* && "$out" != *deploy-called* ]]; then
        echo "ok      $name"
    else
        echo "FAILED  $name: expected a refusal, got: $out"
        failures=$((failures + 1))
    fi
}

expect_deploy  "a full SHA is deployed"                    -c "deploy $SHA"
expect_refusal "an interactive login shell is refused"    -l
expect_refusal "a session without arguments is refused"
expect_refusal "an arbitrary command is refused"          -c "id"
expect_refusal "another verb with a SHA is refused"       -c "rollback $SHA"
expect_refusal "Tailscale's su probe is refused"          -c "true"
expect_refusal "the SFTP server is refused"               -c "/usr/sbin/tailscaled be-child sftp"
expect_refusal "a command after the SHA is refused"       -c "deploy $SHA; id"
expect_refusal "a command on a new line is refused"       -c "deploy $SHA
id"
expect_refusal "an uppercase SHA is refused"              -c "deploy ${SHA^^}"
expect_refusal "a short SHA is refused"                   -c "deploy ${SHA:0:7}"
expect_refusal "a 41-character SHA is refused"            -c "deploy ${SHA}0"
expect_refusal "a second space is refused"                -c "deploy  $SHA"
expect_refusal "a glob is refused"                        -c "deploy *"
expect_refusal "an extra argument is refused"             -c "deploy $SHA" extra

if sudo visudo -cf "$HERE/sudoers-deploy" > /dev/null; then
    echo "ok      the sudoers rule parses"
else
    echo "FAILED  the sudoers rule does not parse"
    failures=$((failures + 1))
fi

if out=$(bash "$HERE/deploy.sh" "not-a-sha" 2>&1); then
    echo "FAILED  the deploy script accepted a non-SHA argument"
    failures=$((failures + 1))
elif [[ "$out" == usage:* ]]; then
    echo "ok      the deploy script rejects a non-SHA argument"
else
    echo "FAILED  the deploy script failed for another reason: $out"
    failures=$((failures + 1))
fi

if (( failures > 0 )); then
    echo "$failures check(s) failed" >&2
    exit 1
fi
echo "All deploy access checks passed"
