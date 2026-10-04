# ADR-0005: Access Model — Three Roles and Signed Share Links

**Date:** 2026-10-03
**Status:** Accepted (not yet implemented)

## Context

The original plan had two roles (owner, visitor) and put the whole web
interface in Phase 3. The owner then asked for real data to be visible in a
UI from Phase 1, from any device and any network, and for a way to give a
trusted person temporary, full read-only access.

The data is personal: company correspondence, recruiter names, application
history. Making the UI reachable from anywhere means it is on the public
internet, so authentication must exist from the first day the UI exists.

## Decision

**Three roles:**

- **Owner** — logs in from any device; sees everything; creates share links.
- **Guest** — holds a valid share link; sees everything the owner sees,
  read-only; cannot create links. Seeing third-party data in the owner's
  records is an accepted owner decision; no masking for guests.
- **Visitor** — everyone else; sees only the public health panel and static
  skeletons. The API sends no private data to this role.

**Share links:**

- The owner sets the validity period when creating a link.
- Links are signed and self-expiring. There is no per-link revocation.
  Rotating the signing secret invalidates all links at once.
- On first use, the link is exchanged for a session cookie (`HttpOnly`,
  `Secure`, `SameSite=Lax`, same expiry) and the browser is redirected to a
  clean URL. `Referrer-Policy: no-referrer` is set.

**Phasing:**

- Phase 1: owner login and a minimal read-only application list.
- Phase 3: share links, the public health panel, the full four sections,
  visitor skeletons.

The owner login method is a separate, still-open decision.

## Rationale

Alternatives considered:

1. **UI only behind an SSH tunnel in Phase 1, no login.** Rejected: fails the
   "any device, any network" requirement.
2. **Keep all UI in Phase 3.** Rejected by the owner: real data should be
   visible early.
3. **Revocable share links stored server-side.** Rejected: the owner does not
   need per-link revocation; it would require a transactional store on the
   VM (BigQuery is not suited for it) for no product benefit.
4. **Token kept in the URL for the whole session.** Rejected: leaks through
   browser history, screenshots, and referrer headers.

## Consequences

**Positive:**

- Real data is usable from any device starting in Phase 1.
- Share links need no database.

**Negative / trade-offs:**

- Phase 1 grows: FastAPI read endpoint, Next.js app, authentication, and
  hosting all arrive early, and the login method and hosting decisions must
  be made now.
- A link sent to the wrong person stays valid until it expires unless all
  links are invalidated by rotating the secret.
- Personal data is on an internet-reachable system from the start; the
  authentication must be correct in its first version.
