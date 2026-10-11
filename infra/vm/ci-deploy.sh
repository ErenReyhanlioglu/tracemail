#!/usr/bin/env bash
# The deploy job's work (ADR-0012, ADR-0035), run on the CI runner after it
# joined the tailnet as tag:ci:
#   1. Pin the VM's SSH host key from the tailnet, the way `tailscale ssh`
#      does, and connect only with strict host key checking.
#   2. Pre-deploy gate: on the live VM, the deploy user must be refused an
#      arbitrary command, SFTP, and port forwarding. Each refusal is matched
#      by its message, so a connection failure never counts as a refusal.
#   3. Deploy the commit; the VM's deploy script ends with a smoke test.
#
# Usage: ci-deploy.sh <tailnet host name> <commit SHA>
set -euo pipefail

readonly USAGE="usage: ci-deploy.sh <tailnet host name> <commit SHA>"
host=${1:?$USAGE}
sha=${2:?$USAGE}

fail() {
    echo "FAILED: $*" >&2
    exit 1
}

known_hosts=$(mktemp)
status=$(tailscale status --json)
# jq programs: $host and $ip are jq variables, not shell ones.
# shellcheck disable=SC2016
readonly PEER='.Peer[] | select(.DNSName | startswith($host + "."))'
ip=$(jq -r --arg host "$host" "$PEER"' | [.TailscaleIPs[] | select(contains(":") | not)][0] // empty' <<< "$status")
[[ -n "$ip" ]] || fail "$host is not in the tailnet"
jq -r --arg host "$host" --arg ip "$ip" "$PEER"' | .sshHostKeys // [] | .[] | "\($ip) \(.)"' <<< "$status" > "$known_hosts"
[[ -s "$known_hosts" ]] || fail "the tailnet reports no SSH host key for $host"

ssh_options=(
    -o "UserKnownHostsFile=$known_hosts"
    -o StrictHostKeyChecking=yes
    -o UpdateHostKeys=no
    -o BatchMode=yes
    -o ConnectTimeout=30
)
target="deploy@$ip"

expect_refused() {
    local name=$1 expected=$2
    shift 2
    local out
    if out=$("$@" 2>&1 < /dev/null); then
        fail "$name was allowed"
    fi
    [[ "$out" == *"$expected"* ]] || fail "$name: expected \"$expected\", got: $out"
    echo "Refused as expected: $name"
}

echo "Pre-deploy checks on $host"
expect_refused "an arbitrary command" "This account only runs deploys" \
    ssh "${ssh_options[@]}" "$target" id
expect_refused "SFTP" "sftp disabled" \
    sftp "${ssh_options[@]}" -b /dev/null "$target"
expect_refused "port forwarding" "administratively prohibited" \
    ssh "${ssh_options[@]}" -W 127.0.0.1:22 "$target"

echo "Deploying $sha to $host"
# The SHA is meant to expand here; the VM's gate accepts only this form.
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$target" "deploy $sha"
