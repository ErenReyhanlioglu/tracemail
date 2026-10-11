# Production VM

One Oracle Cloud Always Free Ampere A1 VM runs the Compose stack (ADR-0016).
It has no inbound port open to the internet: administration and deploys go
through Tailscale SSH (ADR-0012), web traffic through Cloudflare Tunnel.

## Sizing (verified 2026-10-11)

Oracle's Always Free allowance for Ampere A1 is 1,500 OCPU hours and 9,000 GB
hours a month, which is **2 OCPUs and 12 GB of memory**, plus 200 GB of
boot and block volume storage in the home region [1]. The local stack idles
at about 1.6 GB (Airflow) plus the API and web app, so memory has room; the
two cores are the tighter limit (see the Cosmos parse note in the roadmap).

Oracle may reclaim an Always Free instance that is idle for 7 days: 95th
percentile CPU, network, and (for A1) memory all below 20% [1]. After the
first deploy the stack used about 16% of memory (see Continuous deployment),
so memory alone may not keep the VM above the threshold; to be checked in
the instance metrics after a week of hourly runs.

## Tailnet policy

The tailnet policy defines the tags and who may SSH to the VM:

```json
"tagOwners": {
	"tag:prod-vm": ["autogroup:admin"],
	"tag:ci":      ["autogroup:admin"],
},
"ssh": [
	{
		"action": "check",
		"src":    ["autogroup:admin"],
		"dst":    ["tag:prod-vm"],
		"users":  ["ubuntu", "root"],
	},
],
```

`check` makes Tailscale ask the owner to re-authenticate with Google
periodically before an SSH session, so a stolen laptop alone cannot reach
the VM.

With the deploy job, the policy adds network grants and a second SSH rule
(ADR-0035). The owner's devices reach everything; the deploy job (`tag:ci`)
reaches only the VM's port 22 and only as `deploy`, in `accept` mode because
the job is non-interactive; the VM itself is granted nothing:

```json
"grants": [
	{"src": ["autogroup:member"], "dst": ["*"], "ip": ["*"]},
	{"src": ["tag:ci"], "dst": ["tag:prod-vm"], "ip": ["tcp:22"]},
],
"ssh": [
	{
		"action": "check",
		"src":    ["autogroup:admin"],
		"dst":    ["tag:prod-vm"],
		"users":  ["ubuntu", "root"],
	},
	{
		"action": "accept",
		"src":    ["tag:ci"],
		"dst":    ["tag:prod-vm"],
		"users":  ["deploy"],
	},
],
```

## Continuous deployment

The deploy job in `.github/workflows/ci.yml` runs after every push to
`main` (ADR-0012, ADR-0035). It needs, once:

1. **Tailscale federated identity** (admin console → Trust credentials →
   Credential → OpenID Connect): issuer GitHub
   (`https://token.actions.githubusercontent.com`), subject
   `repo:ErenReyhanlioglu@116086022/tracemail@1403471837:environment:production`,
   scope `auth_keys` (write) with tag `tag:ci`. It returns a client ID and an
   audience; neither is a secret. The subject carries the owner's and the
   repository's numeric IDs: GitHub uses this immutable format for
   repositories created from 2026-07-15 [2], so a deleted and recreated
   repository, or a reused owner name, cannot match it. The first deploy
   failed with the name-only subject; Tailscale's credential page showed the
   subject it received.
2. **GitHub environment** `production` (repository Settings →
   Environments): deployment branches limited to `main`; environment
   variables `TS_CLIENT_ID` and `TS_AUDIENCE` from step 1. GitHub puts
   `environment:production` in the job's OIDC subject, which is what the
   federated identity trusts, so no other branch or workflow can join the
   tailnet.
3. **GHCR packages public** (`tracemail-airflow`, `tracemail-api`,
   `tracemail-web`): the VM pulls anonymously. GitHub's documentation says
   a new package starts private [3], but these three were public after the
   first push from `main` with no change by the owner (anonymous manifest
   requests returned HTTP 200). If a new package is private, make it public
   in its package settings and re-run the deploy job.

Each deploy job pins the VM's SSH host key from the tailnet, checks that
`deploy` is refused an arbitrary command, SFTP, and port forwarding, then
runs `deploy <SHA>`; the deploy script ends with a smoke test of
`/api/v1/health` through the web app. Rollback: re-run the deploy job of an
earlier successful run.

First deploy (2026-10-11, commit `8cd9bca`): the deploy job took 4 min 5 s,
including the first pull of every image. The next deploy (`dc18f29`, a
documentation change) took 1 min 47 s: 4 s to join the tailnet and 1 min
39 s for the checks, the deploy, and the smoke test; most of it is the stack
restarting, since every commit gets a new image tag.

Image builds on the arm64 runner (pull request runs, 2026-10-11): without a
cache, airflow 3 min, web 2 min, api 39 s; with the layer cache, 20 s, 27 s,
and 18 s. GitHub's cache is scoped by branch, so `main` cannot use a pull
request's cache and its first build ran without one. All three access checks were
refused as expected, all services came up healthy, and the smoke test
returned `{"status":"ok","bigquery":"ok"}`. Memory in use afterwards was
1.8 of 11 GiB, below the 20% idle-reclamation threshold; whether the
hourly runs keep the VM above it is to be read from the instance metrics
after a week.

## Creating the VM

1. Tailscale admin → Settings → Keys → Generate auth key: **not reusable**,
   **not ephemeral**, **pre-approved**, tag `tag:prod-vm`, expiry 1 day.
2. Oracle console → Compute → Instances → Create instance, in the home
   region (Germany Central, Frankfurt):
   - Image: Canonical Ubuntu 24.04 (aarch64).
   - Shape: Ampere `VM.Standard.A1.Flex`, 2 OCPUs, 12 GB.
   - Networking: a new VCN with a public subnet and a public IPv4 address
     (outbound traffic only). Do not add an SSH key.
   - Advanced options → Management → cloud-init script: this folder's
     `cloud-init.yaml` with the auth key filled in.
   - Boot volume: the default size (within the 200 GB allowance).
3. After the instance starts: VCN → Security Lists → remove every ingress
   rule, including SSH (22). The VM needs only outbound traffic.
4. The VM appears in the tailnet as `tracemail-prod`; connect with
   `ssh ubuntu@tracemail-prod`.

"Out of host capacity" is a temporary shortage of free A1 hosts; try another
availability domain or retry later [1].

## Verified (2026-10-11)

- AD-3 returned "out of capacity" for `VM.Standard.A1.Flex`; another
  availability domain in Frankfurt had capacity.
- The instance form could not assign a public IPv4 address while creating
  its own VCN; creating the VCN first with the console's "VCN with Internet
  Connectivity" wizard worked. The wizard also creates a private subnet with
  NAT and service gateways, which the VM does not use; whether they cost
  anything on a Free Tier tenancy could not be read from Oracle's pricing
  page (HTTP 403) and is to be checked in Cost Analysis.
- The public subnet's security list has **no ingress rules**; egress allows
  all traffic.
- cloud-init finished with no errors. Its status is "degraded" only because
  of the expected warning that no SSH public key was supplied.
- Over Tailscale SSH (direct connection, no relay): Ubuntu 24.04.5 on
  `aarch64`, 2 cores, 11 GiB memory available, 96 GB root filesystem,
  Docker 29.1 and Compose 2.40, `ubuntu` in the `docker` group, time zone
  UTC, `unattended-upgrades` active.

## Stack and deploy user

Run on the VM as `ubuntu`. Layout:

| Path | Contents | Owner, mode |
|---|---|---|
| `/opt/tracemail/app` | Checkout of this repository; the deploy script moves it to the deployed commit | root |
| `/opt/tracemail/app/.env` | Production settings (`just vm-env` copies the owner's `.env.prod`) | root, 600 |
| `/opt/tracemail/app/infra/config/sender_exclusions.yaml` | Private exclusion list (`just vm-exclusions`) | root, 640 |
| `/opt/tracemail/secrets` | Role key files (`infra/gcp/README.md`) | root, 750 / 640 |
| `/opt/tracemail/release.env` | `TRACEMAIL_IMAGE_TAG=<deployed SHA>`, written by each deploy | root |

Containers run as group 0 (`50000:0`, `10001:0`), so group-readable root
files are readable inside them and by no other user on the VM.

1. Tailscale SSH without SFTP and port forwarding (ADR-0035). Restarting
   tailscaled drops the session; reconnect after a few seconds.

   ```sh
   systemctl cat tailscaled | grep EnvironmentFile   # expect /etc/default/tailscaled
   printf 'TS_SSH_DISABLE_SFTP=true\nTS_SSH_DISABLE_FORWARDING=true\n' | sudo tee -a /etc/default/tailscaled
   sudo systemctl restart tailscaled
   ```

2. Checkout, secrets, and the deploy user:

   ```sh
   sudo git clone https://github.com/ErenReyhanlioglu/tracemail.git /opt/tracemail/app
   cd /opt/tracemail/app
   # Globs expand in root's shell: after the chown, ubuntu cannot list the folder.
   sudo sh -c 'chown root:root /opt/tracemail/secrets /opt/tracemail/secrets/* \
     && chmod 750 /opt/tracemail/secrets && chmod 640 /opt/tracemail/secrets/*'
   sudo install -o root -g root -m 755 infra/vm/deploy-gate.sh /usr/local/sbin/tracemail-deploy-gate
   sudo install -o root -g root -m 755 infra/vm/deploy.sh /usr/local/sbin/tracemail-deploy
   sudo visudo -cf infra/vm/sudoers-deploy \
     && sudo install -o root -g root -m 440 infra/vm/sudoers-deploy /etc/sudoers.d/tracemail-deploy
   sudo useradd --system --create-home --shell /usr/local/sbin/tracemail-deploy-gate deploy
   ```

   Reinstall a script the same way after it changes; deploys never rewrite
   the installed copies.

3. From the owner's machine: `just vm-env` and `just vm-exclusions`.

4. Checks. Tailscale runs sessions through `su -l <user> -c`, so `su`
   exercises the same gate:

   ```sh
   id deploy                       # no docker group
   sudo -l -U deploy               # only /usr/local/sbin/tracemail-deploy ^[0-9a-f]{40}$
   sudo su -l deploy -c id         # refused
   sudo su -l deploy -c true       # refused
   sudo su -l deploy               # refused (interactive)
   ```

Verified on the VM (2026-10-11):

- tailscaled's environment contains both `TS_SSH_DISABLE_*` settings after
  a reboot (read from `/proc/<pid>/environ`).
- sudo 1.9.15p5 accepts the regex rule (`visudo -cf`: parsed OK).
- `deploy` belongs only to its own group; `sudo -l -U deploy` lists the one
  rule.
- Through the gate (`su -l deploy -c ...`): `id`, `true`, and an interactive
  session are refused; `deploy <40 zeros>` passes the gate and the sudo rule,
  and the deploy script refuses it as not on `main`.
- Bypassing the gate (`sudo -u deploy sudo -n ...`): the deploy script with
  argument `id` and `/bin/bash` are both refused by sudo.
- From the owner's machine: `sftp` gets "sftp disabled"; `ssh -W` gets
  "administratively prohibited: port forwarding is disabled"; a plain
  `ssh ubuntu@tracemail-prod "<command>"` still works.

Manual Compose commands need the release file as well, for example:

```sh
cd /opt/tracemail/app
sudo docker compose -f infra/compose.yaml --env-file .env --env-file ../release.env ps
```

### `.env.prod`

A copy of `.env.example` with production values. Differences from `.env`:

- `TRACEMAIL_GCP_PROJECT=tracemail-prod`, `TRACEMAIL_DATA_BUCKET=tracemail-prod-data`.
- The three credentials files: `/opt/tracemail/secrets/tm-ingestion.key.json`,
  `tm-transform.key.json`, `tm-api.key.json`; `TRACEMAIL_DBT_TARGET=prod`.
- New Airflow and session secrets, never the dev ones.
- `TRACEMAIL_IMAGE_REGISTRY=ghcr.io/<lowercase GitHub owner>`; no
  `TRACEMAIL_IMAGE_TAG` (from `release.env`).
- `TRACEMAIL_TUNNEL_TOKEN_FILE=/opt/tracemail/secrets/tunnel-token`, and
  `COMPOSE_PROFILES=tunnel` once the tunnel exists.
- `TRACEMAIL_SENDER_EXCLUSIONS_PATH`: unused on the VM (Compose sets the
  container path); any value.

## References

1. [Always Free Resources — Oracle Cloud Infrastructure Documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
2. [Immutable subject claims for GitHub Actions OIDC tokens — GitHub Changelog](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)
3. [Configuring a package's access control and visibility — GitHub Docs](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)
