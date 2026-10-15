# ADR-0040: Viewer Routing — the Health Panel as the Public Landing Page

**Date:** 2026-10-13
**Status:** Accepted

## Context

The site goes public with its domain, linked from a CV. Until now every
viewer without a session landed on the login page: the site root opened the
application list, which redirected to `/login`. Only the owner can ever sign
in (ADR-0005, ADR-0015), so for every other visitor the login page is a dead
end, and the public health panel, the one page meant for them (SUMMARY.md,
Interface), was not reachable at all.

A Google account other than the owner's that tried to sign in received the
API's raw JSON `403` with its own `sub` (ADR-0032, point 5), which existed
so the owner could find their own `sub` during first setup. The owner's `sub`
is configured since step 1.9.

Google's OpenID configuration lists only the `public` subject identifier
type [1], which "provides the same sub (subject) value to all Clients" [2],
so the `sub` known from the dev OAuth client is also the owner's `sub` on
the production client. Verified on 2026-10-13 by reading Google's discovery
document; not yet by a production sign-in.

## Decision

1. **Each viewer lands on their own start page.** The site root asks the API
   for the session's role before any streaming starts: the owner goes to the
   application list, everyone else to the public health panel (`/health`).
   A private page opened without a valid session also sends the viewer to
   the panel, not to the login page.
2. **The login page is reached from the panel** (a "Giriş" link in the
   sidebar footer, where the owner sees "Çıkış"). It states up front that
   TraceMail is personal, that only the owner can sign in, and that there is
   no sign-up; it links back to the panel.
3. **A refused or failed login returns to the login page** with a reason
   code (`/login?error=not_authorized` or `?error=failed`, `303`), and the
   page explains it in Turkish. No account identifier is shown or put in
   the address. This replaces ADR-0032's point 5; the API's JSON `403` and
   `400` answers are gone.
4. **Visitors see the navigation** with the private sections locked and not
   linked (a lock icon, ADR-0041), and "ziyaretçi" in the footer. Until
   Phase 3 the health panel introduces the system: what it does, how data
   flows, its principles, its roadmap, and what it runs on, with links to
   the source code and the decision records. Every statement is backed by an
   ADR, and a note says live metrics are on their way; it shows no numbers,
   since the public panel shows real data or nothing.
5. **Guests (Phase 3)** land on the health panel after a share link is
   exchanged for a session, like everyone else, and reach the private
   sections from the navigation.

## Rationale

1. **Keep the login page as the default landing.** Rejected: only one person
   can use it; for everyone else it explains nothing about the system.
2. **Decide in the Next.js proxy from the session cookie's presence.**
   Rejected: CLAUDE.md keeps all authentication logic in the API; the root
   page asks the API (`/api/v1/auth/me`) instead, which costs one local call.
3. **Show the refused account its `sub` on the friendly page** (in the
   address or the page). Rejected: the owner's `sub` is configured and is
   the same for every client [1][2], so it would show strangers an opaque
   identifier for no use.

## Consequences

**Positive:**

- A visitor from the CV link sees the public part of the system first, and
  learns why they cannot sign in instead of meeting a JSON error.
- The owner's flow is unchanged: the root opens the application list.

**Negative / trade-offs:**

- A private page opened directly without a session streams (ADR-0039), so
  the visitor sees the owner's layout for a moment before the redirect;
  visitors arrive through the root, which redirects before streaming.
  Revisit with the visitor skeletons in Phase 3.
- An owner whose session expired lands on the panel and signs in from its
  footer, one click more than before.
- If the owner ever changes Google account, its `sub` must be read
  elsewhere (for example from a decoded ID token), since the API no longer
  shows it.

**Note, 2026-10-15:** a visitor opening a private section no longer lands on
the health panel. Each section has its own locked page in the same frame:
what the section holds and that its data is never sent to the page, with a
link to the panel. Without a session cookie the page does not call the API.

## References

1. [OpenID configuration — Google](https://accounts.google.com/.well-known/openid-configuration) (`subject_types_supported: ["public"]`, read 2026-10-13)
2. [OpenID Connect Core 1.0, section 8: Subject Identifier Types — OpenID Foundation](https://openid.net/specs/openid-connect-core-1_0.html#SubjectIDTypes)
