# ADR-0016: Self-Host the Web App on the VM behind Cloudflare Tunnel

**Date:** 2026-10-04
**Status:** Accepted (implemented; public on the domain since 2026-10-14)

## Context

The FastAPI API runs on the Oracle VM: data access and all authentication live
there (ADR-0015). The open question was where the Next.js app runs, and how
both are reached from the internet.

Verified constraints:

- Google OAuth redirect URIs must use HTTPS, cannot be raw IP addresses, and
  their host TLD must be on the public suffix list [1]. A registered domain is
  therefore required regardless of hosting choice.
- Cloudflare Tunnel connects a server to Cloudflare's edge through an
  outbound-only connection; no inbound port needs to be open. Tunnels are free
  with unmetered bandwidth; a public hostname requires the domain's DNS to be
  on Cloudflare [2][3].
- Next.js `output: "standalone"` produces a minimal self-contained server
  suited to Docker; the official docs state Docker deployment supports all
  Next.js features [4][5].
- Vercel's Hobby plan is free for non-commercial personal use with limits far
  above this project's needs [6][7]. (Secondary sources only.)
- Domain prices vary mostly between first year and renewal. First-year
  promotions for `.com` were reported between roughly USD 3 and 7, with
  renewals at Turkish registrars around TRY 390–550 per year; flat-priced
  registrars (Cloudflare, Porkbun) were reported around USD 10.5–11 for both
  registration and renewal; `.com.tr` was reported around USD 1.5–2 per year
  [8][9][10][11]. (Secondary sources only.)

## Decision

- **Everything runs on the VM in the one Docker Compose stack:** Airflow,
  FastAPI, Next.js (standalone build), and `cloudflared`.
- **Ingress only through Cloudflare Tunnel.** The VM opens no inbound port to
  the internet: web traffic arrives through the tunnel, SSH through Tailscale
  (ADR-0012). The Oracle security list allows no public ingress.
- **One origin:** the site and the API are served under the same hostname,
  with the API under `/api/`. Session cookies are first-party and need no
  cross-domain configuration.
- **A registered domain (`.com` or `.com.tr`) with its DNS on Cloudflare.**
  The registrar does not matter for the tunnel — only the nameservers do — so
  the domain is bought wherever the first year is cheapest. The domain name
  and the registrar are the owner's choice. Renewal or a registrar move is
  decided when the first year ends. This is the project's first required
  cost.
- **Oracle region:** `eu-frankfurt-1`, chosen for latency to the owner, since
  the site's responsiveness depends on the VM's location while hourly batch
  work does not. If free Ampere capacity is unavailable there at sign-up,
  another European region is used. The region cannot be changed after the
  account is created (not verified).

## Rationale

Alternatives considered:

1. **Next.js on Vercel, API on the VM.** Rejected: the API still needs a
   domain and a tunnel, so this adds Vercel on top of every component of the
   chosen design; the site and API end up on two origins, which complicates
   session cookies in the most security-sensitive code; and there are two
   deploy targets and two answers to "what is running in production".
2. **Open ports 80/443 on the VM with a reverse proxy and its own TLS.**
   Rejected: exposes the VM directly to the internet when the tunnel provides
   the same reachability with no open ports, plus Cloudflare's DDoS
   protection.
3. **Free subdomain services instead of a registered domain.** Rejected: a
   tunnel's public hostname requires a domain whose DNS is on Cloudflare.

## Consequences

**Positive:**

- The VM has no internet-facing ports at all.
- One Compose definition, one deploy, one version shown on the health panel.
- First-party cookies keep authentication simple.

**Negative / trade-offs:**

- Dependency on Cloudflare: if it is unavailable, the site is unreachable;
  hourly ingestion continues.
- Page responsiveness depends on the VM's distance to the visitor; mitigated
  by choosing a European region and caching reads.
- A domain cost every year; promotional first-year prices do not hold at
  renewal.
- The hostname is configuration, not code: changing the domain later means
  updating the tunnel's public hostname, the Google OAuth redirect URI, and
  the site's base URL setting.
- Verified 2026-10-14: a `.com.tr` domain's nameservers can be delegated to
  Cloudflare. TRABIS delegated `tracemail.com.tr` after its document check;
  Cloudflare then reported the zone active.

## Verified (2026-10-14)

Requests from outside to `tracemail.com.tr`:

- `https://` answers through Cloudflare (`Server: cloudflare`); the root
  sends a visitor to the health panel (307), unknown paths return 404, and
  the API refuses a private list without a session (401).
- `http://` is redirected to `https://` (301) by Cloudflare's "Always Use
  HTTPS", with no redirect loop, since the app issues no HTTPS redirect of
  its own.
- Responses carry the headers of ADR-0038: CSP with a nonce, HSTS,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and
  `Permissions-Policy`.
- Google sign-in redirects to the production OAuth client with the
  callback `https://tracemail.com.tr/api/v1/auth/google/callback`, and the
  owner signed in.

Not re-checked on this date: the VM's ingress rules, which had no inbound
rule when checked on 2026-10-11 and 2026-10-12 (`infra/vm/README.md`).
`www.tracemail.com.tr` has no DNS record and does not resolve.

## References

1. [Manage OAuth Clients (redirect URI rules) — Google Cloud Help](https://support.google.com/cloud/answer/15549257?hl=en)
2. [Cloudflare Tunnel Is Now Fully Free — bex.co](https://bex.co/blog/2026/07/28/cloudflare-tunnel-free-zero-open-ports-ingress) (known from search-result summaries)
3. [Cloudflare Tunnel in 2026 — DEV Community](https://dev.to/recca0120/cloudflare-tunnel-in-2026-expose-localhost-without-opening-ports-or-buying-an-ip-32l5) (known from search-result summaries)
4. [Deploying — Next.js docs](https://nextjs.org/docs/app/getting-started/deploying) (known from search-result summaries)
5. [Containerize a Next.js application — Docker docs](https://docs.docker.com/guides/nextjs/) (known from search-result summaries)
6. [Vercel free tier limits in 2026 — promptstoproduct](https://www.promptstoproduct.com/vercel-free-tier-limits) (known from search-result summaries)
7. [Is Vercel Free? Hobby Limits and the Commercial Clause (2026)](https://justinmckelvey.com/blog/is-vercel-free) (known from search-result summaries)
8. [Cheapest Domain Registrars 2026 — Real 5-Year Cost — domaindetails](https://domaindetails.com/registrars/cheapest) (known from search-result summaries)
9. [Namecheap vs GoDaddy vs Spaceship vs Porkbun: 2026 Pricing — domainoffer](https://domainoffer.net/blog/namecheap-vs-godaddy-vs-spaceship-vs-porkbun) (known from search-result summaries)
10. [Domain Fiyatları 2026 — Karekod Blog](https://www.karekod.org/blog/domain-fiyatlari/) (known from search-result summaries)
11. [Domain Fiyatları 2026 — inetmar](https://www.inetmar.com/domain/domain-fiyatlari/) (known from search-result summaries)
