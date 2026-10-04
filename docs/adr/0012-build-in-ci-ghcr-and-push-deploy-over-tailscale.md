# ADR-0012: Build in CI, Publish to GHCR, Push-Deploy over Tailscale

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

Every merge to `main` deploys (ADR-0002). The VM is an `arm64` Oracle
instance. Three questions: where images are built, where they are stored, and
how the VM learns about a new image.

The repository and its images will be public (portfolio project). Images
contain no secrets or personal data (CLAUDE.md).

Verified facts:

- GitHub's `arm64` hosted runners (`ubuntu-24.04-arm`) are generally available
  and free for public repositories [1][2].
- GHCR is free for public images [3][4]. (Private-image limits were read from
  third-party summaries only and are irrelevant for a public repository.)
- Watchtower, the best-known pull-based updater, was archived in December 2025
  and is unmaintained [5].
- A forced command in `authorized_keys` ignores the command the client sends
  [6]. However, 2026 advisories report that the `restrict` keyword did not
  cover tunnel forwarding in affected OpenSSH versions [7][8]; secondary sources
  disagree on the fixed version, and the issue was not visible on OpenSSH's own
  security page when checked [9]. A single SSH option is therefore not treated
  as a sufficient control.
- Membership in the `docker` group is equivalent to root [10].
- Current hardening guidance for GitHub Actions ranks SHA-pinning third-party
  actions, OIDC instead of long-lived secrets, and avoiding
  `pull_request_target` in public repositories among the highest-impact
  measures [11]. GitHub can enforce SHA pinning by policy since August 2025
  [12]. The `tj-actions/changed-files` compromise (March 2025) leaked secrets
  from over 23,000 repositories through re-pointed version tags [13]. GitHub
  hardened `pull_request_target` in late 2025 and `actions/checkout` in 2026
  [14].
- Environment secrets are available only to jobs that use the environment,
  and environments can be restricted to selected branches [15].
- Tailscale can admit a GitHub Actions runner to a private network using a
  short-lived OIDC token, with no public SSH port and no long-lived key [16].
  Its free Personal plan covers up to 6 users with unlimited devices [17][18].

## Decision

- **Build:** GitHub Actions on a native `arm64` runner, after CI passes on
  `main`.
- **Registry:** GHCR, public images, tagged with the commit SHA.
- **Deploy (push):** the deploy job joins the owner's tailnet via OIDC, then
  runs the deploy script on the VM over SSH. The script accepts only a commit
  SHA, verifies its format, pulls that SHA's image from this repository's GHCR
  namespace, and restarts the stack.

Controls:

1. SSH on the VM listens only on the Tailscale interface; port 22 is closed to
   the internet. The owner administers the VM over Tailscale as well.
2. No long-lived credential in GitHub grants access to the VM.
3. The deploy user can run only the deploy script (forced command), as a
   defense-in-depth layer, not as the primary control. A test verifies that
   any other command is refused.
4. OS and OpenSSH security updates install automatically.
5. All actions are pinned to full commit SHAs, enforced by repository policy.
6. `pull_request_target` is never used. Deploy triggers only on push to
   `main` and runs in a `production` environment restricted to `main`.
7. The owner's GitHub account uses two-factor authentication.

Rollback is re-running the deploy workflow for an earlier commit SHA.

## Rationale

Alternatives considered:

1. **Build on the VM.** Rejected: builds compete with hourly runs for CPU and
   memory, and rollback requires keeping old images locally.
2. **Pull-based deploy (VM polls the registry).** Rejected: deploy status is
   not visible in GitHub, rollback is manual on the VM, and the best-known tool
   is unmaintained [5].
3. **Push over a public SSH port with a restricted key in GitHub secrets.**
   Rejected after research: it keeps a long-lived key in GitHub and exposes
   sshd to the internet, and the 2026 advisories show `restrict` alone is
   fragile [7][8].

## Consequences

**Positive:**

- No public SSH surface; no long-lived VM credential outside the VM.
- Deploy status, history, and rollback all live in GitHub.
- Building never affects the running system.

**Negative / trade-offs:**

- Dependency on Tailscale: if it is unavailable, deploy and SSH
  administration pause; the public site keeps running. Emergency access via
  Oracle's web console is to be verified when the account exists.
- One more service to configure (tailnet, ACLs, OIDC trust).

## References

1. [arm64 hosted runners for public repositories are now generally available — GitHub Changelog](https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/)
2. [GitHub-hosted runners reference — GitHub Docs](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
3. [Introducing GitHub Container Registry — GitHub Blog](https://github.blog/news-insights/product-news/introducing-github-container-registry/)
4. [GHCR Guide — Gecko Security](https://gecko.security/blog/ghcr-github-container-registry-guide)
5. [Goodbye containrrr/watchtower — GitHub Discussion](https://github.com/containrrr/watchtower/discussions/2135)
6. [sshd(8) manual, AUTHORIZED_KEYS FILE FORMAT — OpenBSD](https://man.openbsd.org/sshd.8)
7. [CVE-2026-73283 — SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2026-73283/)
8. [USN-8721-1: OpenSSH vulnerabilities — Ubuntu](https://ubuntu.com/security/notices/USN-8721-1)
9. [OpenSSH Security](https://www.openssh.org/security.html)
10. [Privilege escalation through Docker group membership — Securitum](https://www.securitum.com/privilege_escalation_through_docker_group_membership_and_sudo_backdoor.html)
11. [GitHub Actions Security Checklist 2026 — Stingrai](https://www.stingrai.io/blog/github-actions-security-checklist)
12. [GitHub Actions policy now supports blocking and SHA pinning actions — GitHub Changelog](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/)
13. [tj-actions/changed-files supply chain attack (CVE-2025-30066) — Wiz](https://www.wiz.io/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066)
14. [GitHub Updates actions/checkout to Block Common Pwn Request Attack Patterns — The Hacker News](https://thehackernews.com/2026/06/github-updates-actionscheckout-to-block.html)
15. [Managing environments for deployment — GitHub Docs](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)
16. [GitHub Actions to VPS: Zero-Trust with Tailscale — DEV Community](https://dev.to/rihdusr/github-actions-to-vps-zero-trust-with-tailscale-2omf)
17. [Tailscale pricing](https://tailscale.com/pricing)
18. [Is Tailscale Free? Personal Plan Limits (2026) — Costbench](https://costbench.com/software/business-vpn/tailscale/free-plan/)
