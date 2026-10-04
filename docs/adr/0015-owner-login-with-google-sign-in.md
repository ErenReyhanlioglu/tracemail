# ADR-0015: Owner Login with Google Sign-In, Handled by the API

**Date:** 2026-10-04
**Status:** Accepted (not yet implemented)

## Context

ADR-0005 puts the owner's login in Phase 1: the UI is on the public internet,
the data is personal, and the owner must be able to log in from any device
and network. The login must be correct from its first version and should
cost the owner as little friction as possible.

Relevant findings:

- Google OAuth apps that request only basic identity scopes (`openid`,
  `email`, `profile`) need no app verification, and the 100-test-user cap of
  "Testing" status does not apply to them [1][2][3].
- NIST SP 800-63B-4 (August 2025) accepts synced passkeys at AAL2 and asks
  verifiers to encourage phishing-resistant authentication [4][5][6].
- Auth.js (NextAuth) moved to security-only maintenance under Better Auth in
  September 2025; its maintainers recommend Better Auth for new projects
  [7][8].
- Share links (ADR-0005) are exchanged for a signed session cookie by the
  backend; private data is served by the FastAPI API.

## Decision

- The owner logs in with **Google Sign-In (OpenID Connect)**, requesting only
  `openid` and `email`.
- **The FastAPI API owns all authentication**: the Google callback, owner
  sessions, the share-link exchange, and guest sessions. Next.js forwards the
  session cookie to the API server-side and contains no authentication logic.
- The owner is identified by Google's stable subject identifier (`sub`),
  not by email address. The allowed `sub` is configuration on the server,
  never in the repository.
- Any other Google account receives "not authorized"; no account is created.
- The owner session is a signed cookie (`HttpOnly`, `Secure`,
  `SameSite=Lax`) with a long lifetime, configurable, defaulting to 90 days.
  Rotating the signing secret logs out every session, owner and guest.

Owner experience: on a new device, tap "Sign in with Google", pick the
account, return to the site; nothing more on that device until the session
expires. One-time setup: create an OAuth client in the prod GCP project.

## Rationale

Alternatives considered:

1. **Passkeys (WebAuthn) implemented in the app.** Deferred: the strongest
   option, but registration, verification, and lost-passkey recovery are all
   custom code in the most security-sensitive part of the system. Can be
   added later as an additional method in a new ADR.
2. **Password + TOTP.** Rejected: password storage, lockout, and rate limiting
   become our responsibility, and the method is phishable.
3. **Hosted auth provider (Clerk, Auth0, etc.).** Rejected: a new external
   account and dependency for a single user.
4. **A long-lived secret owner link (same mechanism as guest links).**
   Rejected: lowest friction, but it is a password in a URL with no second
   factor; a leak grants full owner rights, including creating share links,
   until the signing secret is rotated.
5. **Authentication in Next.js (Auth.js / Better Auth).** Rejected: data and
   share links live in the API; splitting authentication across two services
   doubles the surface the privacy tests must cover.

## Consequences

**Positive:**

- Minimal custom authentication code; password handling, second factor, and
  suspicious-login detection are delegated to Google.
- No new trust relationship: the mailbox already lives in the same Google
  account.
- One place enforces owner, guest, and visitor access.

**Negative / trade-offs:**

- Login depends on Google's availability.
- The site's security equals the owner's Google account security; the owner
  account should use two-step verification or a passkey.
- A stolen session cookie is valid until it expires (default 90 days) or the
  signing secret is rotated.

## References

1. [OAuth app state overview — Google for Developers](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
2. [Manage App Audience — Google Cloud Help](https://support.google.com/cloud/answer/15549945?hl=en)
3. [Google OAuth 100 User Limit (2026) — Unipile](https://www.unipile.com/google-oauth-100-user-limit/) (known from search-result summaries)
4. [NIST SP 800-63B-4 Digital Identity Guidelines — NIST](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63B-4.pdf) (known from search-result summaries)
5. [NIST SP 800-63-4 Is Final — AuthLayer](https://authlayer.dev/blog/nist-800-63-4-authentication-requirements/)
6. [NIST Passkeys: Synced Passkeys Recognized as AAL2-Compliant — Corbado](https://www.corbado.com/blog/nist-passkeys)
7. [Auth.js is now part of Better Auth — nextauthjs Discussion #13252](https://github.com/nextauthjs/next-auth/discussions/13252)
8. [Best auth library for Next.js in 2026 — LogRocket](https://blog.logrocket.com/best-auth-library-nextjs-2026/)
