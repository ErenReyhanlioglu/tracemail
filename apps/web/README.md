# Web app

Next.js app (standalone build): owner login, the application list, the
incoming postings list, and the public health panel where visitors land
(a placeholder until Phase 3, ADR-0040), with the design system of ADR-0034,
the page states of ADR-0039, and Turkish UI copy (ADR-0033). It contains no authentication logic; it forwards the session
cookie to the API, which it reaches through its `/api` rewrite, so the site and
the API share one origin.

Implemented in Phase 1, step 1.10. In production it runs on the VM in the
Compose stack and is reached through Cloudflare Tunnel once the domain is
active (ADR-0016).

Locally: `just up` runs it with the whole stack on port 3000; `just web` runs
the development server against `just api`.
