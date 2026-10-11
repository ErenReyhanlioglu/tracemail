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

## References

1. [Always Free Resources — Oracle Cloud Infrastructure Documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
