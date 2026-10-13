# ADR-0032: Owner Login Implementation — Authlib, a Signed Session Cookie, and Fixed Routes

**Date:** 2026-10-10
**Status:** Accepted; point 5 (refusal page) superseded by [ADR-0040](0040-viewer-routing-and-public-landing.md)

## Context

ADR-0015 decided what the owner login is: Google Sign-In (OpenID Connect)
with `openid` and `email`, handled entirely by the FastAPI API, the owner
matched by Google's `sub`, and a signed `HttpOnly`, `Secure`, `SameSite=Lax`
session cookie lasting 90 days by default. It left the implementation open.
Step 1.9 builds it, and the OAuth client's redirect URI has to be
registered in the dev project before any code runs.

Verified 2026-10-10:

- The mailbox account and the Google Cloud account are two different Google
  accounts. ADR-0015's remark that the mailbox "already lives in the same
  Google account" does not hold. The OAuth client lives in the dev project
  (under the Cloud account); the owner chose the **mailbox account** as the
  login account, and it is the client's only test user.
- The dev OAuth client exists (web application type, created 2026-10-10),
  with the redirect URI of step 1.9 below.

Findings from current sources:

- **Redirect URIs.** Google requires HTTPS except for `localhost`, allows
  several redirect URIs per client, and takes from minutes to hours to apply
  a change. The client secret is shown once; afterwards only its last four
  characters are visible [1].
- **What to validate.** Google's ID token is a signed JWT checked against the
  keys in the discovery document's `jwks_uri`; `aud` must be the client ID,
  `exp` must not have passed, `nonce` must match the request, and `sub` is the
  stable account identifier Google recommends as the user key [2].
- **PKCE.** RFC 9700 (OAuth 2.0 Security BCP, January 2025) recommends PKCE
  for confidential clients too, against authorization-code injection and as
  CSRF protection; OpenID Connect clients may use `nonce` instead, with extra
  precautions [3].
- **Authlib.** The latest release is 1.8.0 (2026-08-30), depending on
  `cryptography` and `joserfc` [4]. Its Starlette client loads Google's
  settings from the discovery URL and parses and validates the ID token when
  `openid` is in scope, returning it as `token["userinfo"]` [5]. Its source
  generates a fresh `nonce` whenever `openid` is in scope, and a PKCE
  verifier when the client is registered with a `code_challenge_method` [6].
  It keeps that per-login state in `request.session`, so it needs Starlette's
  `SessionMiddleware` [7].
- **Starlette `SessionMiddleware`.** Signs the cookie with `itsdangerous`'
  `TimestampSigner`, rejects a cookie older than `max_age` on read, and
  re-issues the cookie only when the session changes, so reading does not
  extend its life [8]. The cookie is always `HttpOnly`; `same_site` defaults
  to `lax`; `https_only` adds `Secure`. The contents are signed, not
  encrypted: the browser can read them but not change them [9].
- **`Secure` cookies on `http://localhost`.** Chrome (89+) and Firefox (75+)
  accept them; Safari does not [10][11]. Third-party summary, not browser
  documentation.
- **Same origin through Next.js.** A Next.js rewrite of `/api/:path*` to the
  API makes the browser see one origin, so no CORS setup is needed and the
  cookie stays first-party [12]. Known from community sources only; verified
  in step 1.10.

## Decision

1. **Library:** Authlib's Starlette client, registered with Google's
   discovery URL, scope `openid email`, and `code_challenge_method="S256"`.
   The application never decodes a JWT itself.
2. **Session:** Starlette's `SessionMiddleware` is the only session store;
   no server-side session table (ADR-0005). The cookie carries the role and
   an absolute expiry written at login, which every private request checks, so
   the lifetime is fixed at login and never slides. Middleware `max_age`
   equals the configured lifetime; `https_only=True` and `same_site="lax"`
   always, with no environment switch, so local development uses Chrome or
   Firefox.
3. **Routes** (all under `/api/v1/auth/`): `GET google/login` (redirect to
   Google), `GET google/callback` (validate, match `sub`, set the session,
   redirect to `/`), `POST logout` (clear the session), `GET me` (the current
   role, for the web app). Any account other than the owner gets `403` and no
   session.
4. **Redirect URI** is built from one configured public base URL plus the
   fixed callback path, never from the incoming request, since behind
   Cloudflare Tunnel the request's scheme and host are not the public ones
   (ADR-0016). Registered URIs:
   - 1.9 (API alone): `http://localhost:8000/api/v1/auth/google/callback`
   - 1.10 (through the Next.js rewrite):
     `http://localhost:3000/api/v1/auth/google/callback`
   - 1.11: `https://<domain>/api/v1/auth/google/callback`, on the prod
     project's own client.
5. **Finding the owner's `sub`:** the `403` page shows the signed-in
   account its own `sub`. The owner signs in once with the API configured
   with a placeholder, copies the value into the server configuration, and
   restarts. Only that account's own identifier is shown, to that account.
6. **Configuration** (API `Settings`, all required, secrets as `SecretStr`):
   Google client ID and secret, owner `sub`, session signing secret, public
   base URL. The session lifetime keeps ADR-0015's 90-day default.

## Rationale

1. **Hand-written OIDC with `httpx` and a JWT library.** Rejected: state,
   nonce, PKCE, key rotation, and claim checks are exactly the code that
   should not be custom.
2. **Google's `google-auth` library for ID-token verification only.**
   Rejected: it verifies tokens but leaves the redirect, state, nonce, and
   PKCE to us.
3. **A JWT as the session cookie.** Rejected: only this API reads the cookie;
   a JWT adds a format and a library without a second reader.
4. **Encrypted cookie.** Rejected: the cookie holds a role, an expiry, and the
   owner's own `sub`, none of which is secret from the owner's browser.
5. **Redirect URI from `request.url_for`.** Rejected: wrong scheme and host
   behind the tunnel (ADR-0016).
6. **A `Secure` switch for local HTTP.** Rejected: a setting that can turn
   `Secure` off can be left off in production.

## Verification

Verified 2026-10-11 against the dev OAuth client, API run locally, Brave
(Chromium) on `http://localhost:8000`:

- The redirect to Google carried scope `openid email`, the registered
  callback URI, a fresh `state` and `nonce`, and a PKCE `S256` challenge.
- With a placeholder owner `sub`, Google's login completed and the API
  answered `403` with the account's own `sub` and set no session.
- With that `sub` configured, the same login set the session cookie, and
  `GET /api/v1/auth/me` returned the owner role.

## Consequences

**Positive:**

- The security-sensitive parts (token validation, nonce, PKCE) come from a
  maintained library.
- One cookie and one middleware also carry the Phase 3 guest session.
- Login works the same locally and in production; only the base URL differs.

**Negative / trade-offs:**

- Safari cannot log in on `http://localhost`; production (HTTPS) is
  unaffected.
- A stolen cookie stays valid until its expiry or a secret rotation
  (ADR-0015).
- Revisit if Authlib's Starlette client stops being maintained, or if a
  second service ever needs to read the session.

## References

1. [Manage OAuth Clients — Google Cloud Help](https://support.google.com/cloud/answer/15549257?hl=en)
2. [OpenID Connect reference — Google for Developers](https://developers.google.com/identity/openid-connect/reference?hl=en)
3. [RFC 9700: Best Current Practice for OAuth 2.0 Security — RFC Editor](https://www.rfc-editor.org/rfc/rfc9700) (known from search-result summaries)
4. [Authlib — PyPI](https://pypi.org/project/Authlib/) (release metadata read through the PyPI JSON API)
5. [Starlette Integration — Authlib 1.7.1 documentation](https://docs.authlib.org/en/1.7.1/oauth2/client/web/starlette.html)
6. [authlib/integrations/base_client/sync_app.py — GitHub](https://github.com/authlib/authlib/blob/main/authlib/integrations/base_client/sync_app.py)
7. [Google login for FastAPI — Authlib blog](https://blog.authlib.org/2020/fastapi-google-login) (2020; pattern unchanged in the 1.7 docs)
8. [starlette/middleware/sessions.py — GitHub](https://github.com/encode/starlette/blob/master/starlette/middleware/sessions.py)
9. [Middleware — Starlette](https://starlette.dev/middleware/)
10. [Secure cookies on localhost — httpwg/http-extensions issue #2605](https://github.com/httpwg/http-extensions/issues/2605) (known from search-result summaries)
11. [Cookie not being set in Safari — Flavio Copes](https://flaviocopes.com/cookie-not-being-set-in-safari)
12. [Next.js configuration and API proxy — DeepWiki](https://deepwiki.com/SpanishHans/Tablemind/7.1-next.js-configuration-and-api-proxy) (community source)
