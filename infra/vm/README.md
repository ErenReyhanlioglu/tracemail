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
percentile CPU, network, and (for A1) memory all below 20% [1]. The stack is
expected to keep memory above that; check after deployment.

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
the VM. `tag:ci` is for the deploy job (step 1.11, deploy workflow); its SSH
rule, in `accept` mode for the non-interactive job, is added with the
workflow.

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
   sudo chown root:root /opt/tracemail/secrets /opt/tracemail/secrets/*
   sudo chmod 750 /opt/tracemail/secrets && sudo chmod 640 /opt/tracemail/secrets/*
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
