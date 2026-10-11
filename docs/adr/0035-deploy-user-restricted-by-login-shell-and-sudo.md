# ADR-0035: Deploy User Restricted by Login Shell and One Sudo Rule

**Date:** 2026-10-11
**Status:** Accepted (not yet implemented)

## Context

ADR-0012 control 3 says the deploy user can run only the deploy script,
enforced by a forced command, as defense in depth behind Tailscale. Its
mechanism assumed OpenSSH: a `command=` option in `authorized_keys`.

The VM is administered through Tailscale SSH (ADR-0012 control 1), which
replaces OpenSSH for tailnet traffic on port 22 and does not read
`authorized_keys`. Tailscale lists "machines where you use `authorized_keys`
to limit what commands remote users can run" among the cases Tailscale SSH
does not fit [1]; per-command restriction is an open feature request [2].
The forced command therefore cannot be implemented as written.

Verified in the Tailscale source (`main`, read 2026-10-11):

- Every session runs the local user's **login shell**: a command as
  `<shell> -c "<command>"`, an interactive session as `<shell> -l`, either
  directly or through `su -l <user> -c` [3].
- SFTP is served by tailscaled itself. It goes through the login shell only
  when the `su` path is used; if Tailscale's probe `su -l <user> -c true`
  fails, SFTP is served in-process **without** the login shell [3].
- Local and remote port forwarding are allowed when the policy grants them,
  and can be switched off on the host with `TS_SSH_DISABLE_FORWARDING`;
  SFTP with `TS_SSH_DISABLE_SFTP` [4]. Unix-socket forwarding is limited to
  the user's home, `/tmp`, and `/run/user/<uid>`, so the Docker socket is
  out of reach [4].
- sudo 1.9.10 and later accept a regular expression as a command argument
  in a sudoers rule [5]; the VM runs sudo 1.9.15p5.

Membership in the `docker` group is equivalent to root [6].

## Decision

The deploy user (`deploy`) is restricted in three layers, none of which
depends on `authorized_keys`:

1. **Login shell gate.** `deploy`'s login shell is
   `/usr/local/sbin/tracemail-deploy-gate` (`infra/vm/deploy-gate.sh`). It
   accepts exactly `-c "deploy <40-hex commit SHA>"` and execs the deploy
   script through sudo; anything else, including an interactive shell, is
   refused.
2. **No privileges of its own.** `deploy` is not in the `docker` group. One
   sudoers rule lets it run `/usr/local/sbin/tracemail-deploy` as root with a
   single argument matching `^[0-9a-f]{40}$`. The script (`infra/vm/deploy.sh`)
   validates the SHA again and deploys only commits reachable from
   `origin/main`.
3. **No paths around the shell.** tailscaled runs with
   `TS_SSH_DISABLE_SFTP=true` and `TS_SSH_DISABLE_FORWARDING=true`.

The installed copies of both scripts are root-owned and change only when the
owner reinstalls them; a deploy never rewrites what sudo runs.

The tailnet policy lets `tag:ci` SSH only to `tag:prod-vm`, only as `deploy`
(action `accept`, since the job is non-interactive).

ADR-0012's test requirement is met in three places:

- **CI, every pull request:** `infra/vm/test-deploy-gate.sh` runs the
  unmodified gate on the runner against a stub deploy script, checks the
  sudoers syntax, and checks the deploy script's argument validation.
- **VM setup, once:** the gate is checked with `su -l deploy -c '<command>'`,
  the path Tailscale uses, and the sudo rule with the gate bypassed
  (`infra/vm/README.md`).
- **Every deploy job:** before deploying, it asserts that an arbitrary
  command, SFTP, and port forwarding are refused for `deploy` on the live VM.

## Rationale

Alternatives considered:

1. **A second OpenSSH server on the tailnet address with `ForceCommand`.**
   Rejected: a second SSH daemon to configure and patch, and port 22 on the
   tailnet address is already Tailscale's [1].
2. **`deploy` in the `docker` group, restricted by the login shell only.**
   Rejected: one bypass of the gate would be root on the VM [6].
3. **Login shell only, SFTP and forwarding left on.** Rejected: SFTP can skip
   the login shell [3], and forwarding gives a CI identity network reach
   inside the VM that deploying does not need.

## Consequences

**Positive:**

- The deploy identity can trigger a deploy of a `main` commit and nothing
  else; a bypass of one layer still meets the next.
- No credential for the VM exists outside the VM and the tailnet.

**Negative / trade-offs:**

- SFTP and port forwarding are off for every user of Tailscale SSH on the VM,
  the owner included. Files are copied with legacy `scp -O`, which runs as a
  shell command; reaching a VM-local web UI (Airflow) needs another route,
  decided when it is needed.
- Behaviour depends on Tailscale SSH internals [3]. The per-deploy refusal
  check catches a change in how commands reach the shell; revisit if
  Tailscale ships native command restriction [2].
- Changing either script means reinstalling it on the VM by hand.

## References

1. [Tailscale SSH — Tailscale Docs](https://tailscale.com/kb/1193/tailscale-ssh)
2. [Tailscale SSH - Restrict user to specific command — Tailscale Forum](https://forum.tailscale.com/t/tailscale-ssh-restrict-user-to-specific-command/2665)
   (known only from a search-result summary; it links the open feature request)
3. [ssh/tailssh/incubator.go — tailscale/tailscale on GitHub](https://github.com/tailscale/tailscale/blob/main/ssh/tailssh/incubator.go)
4. [ssh/tailssh/tailssh.go — tailscale/tailscale on GitHub](https://github.com/tailscale/tailscale/blob/main/ssh/tailssh/tailssh.go)
5. [sudoers manual — sudo.ws](https://www.sudo.ws/docs/man/sudoers.man/)
6. [Privilege escalation through Docker group membership — Securitum](https://www.securitum.com/privilege_escalation_through_docker_group_membership_and_sudo_backdoor.html)
