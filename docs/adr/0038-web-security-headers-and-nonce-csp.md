# ADR-0038: Web Security Headers and a Nonce-Based Content Security Policy

**Date:** 2026-10-13
**Status:** Accepted

## Context

The web app goes public with the domain (ADR-0016). Behind the owner login
it shows third-party data from the mailbox (CLAUDE.md, Privacy), so an
injected script or a page framed by another site would expose it. It sent
no security headers except `Referrer-Policy` from the API.

Read on 2026-10-13:

- Next.js 16.4's CSP guide [1]: a nonce generated per request in
  `proxy.ts` and put in the request's CSP header is applied by Next.js to
  its framework scripts, page bundles, and the inline scripts and styles it
  generates. Nonces require dynamic rendering, which disables static
  optimization. The alternatives are `'unsafe-inline'` in `script-src`, or
  experimental Subresource Integrity hashes. `'unsafe-eval'` is needed in
  development only.
- OWASP's HTTP Headers Cheat Sheet [2]: HSTS
  (`max-age=63072000; includeSubDomains; preload`, with a warning to read
  how it works first), `X-Frame-Options: DENY` alongside CSP
  `frame-ancestors`, `X-Content-Type-Options: nosniff`, an explicit
  `Referrer-Policy`, a `Permissions-Policy` that turns off unused features,
  `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-site`; `X-XSS-Protection` should not
  be set, and `X-Powered-By` removed.

The app loads nothing from other origins at run time: fonts are
self-hosted at build time, the API is same-origin under `/api`, sign-in is
a link to the API, and sign-out a same-origin `fetch`. Every page already
renders per request, because the root layout reads the theme cookie. Two
tables set column widths through `style` attributes.

## Decision

- **Content Security Policy** in `apps/web/src/proxy.ts`, with a fresh
  nonce per page request: `default-src 'self'`; `script-src 'self'
  'nonce-…' 'strict-dynamic'`; `style-src 'self' 'nonce-…'`;
  `style-src-attr 'unsafe-inline'`; `img-src 'self' data: blob:`;
  `font-src`, `connect-src`, `form-action` `'self'`; `object-src 'none'`;
  `base-uri 'none'`; `frame-ancestors 'none'`. The API, static files, and
  link prefetches are not matched. Development adds `'unsafe-eval'` and
  inline styles, as the guide requires.
- **Static headers** on every response, from `next.config.ts`:
  `Strict-Transport-Security: max-age=63072000; includeSubDomains`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, a `Permissions-Policy` turning off camera,
  microphone, geolocation, payment, and USB, `Cross-Origin-Opener-Policy:
  same-origin`, `Cross-Origin-Resource-Policy: same-site`. `X-Powered-By`
  stays off; `X-XSS-Protection` is not set.

## Rationale

1. **`'unsafe-inline'` scripts without a nonce.** Rejected: it lets an
   injected inline script run, which is the attack CSP exists to stop; a
   nonce costs nothing here, since every page renders per request anyway.
2. **Subresource Integrity hashes.** Rejected: experimental [1], and its
   benefit, keeping pages static, does not apply.
3. **Strict styles, moving the column widths into CSS classes.** Rejected
   for now: `style-src-attr 'unsafe-inline'` allows style attributes only;
   `<style>` elements still need the nonce, and with `default-src 'self'` an
   injected style cannot load anything from elsewhere, which leaves little
   to exploit. Revisit if the tables are reworked.
4. **HSTS `preload`.** Left out: preloading puts the domain in browsers'
   built-in lists and is slow to undo [2]; add it once the domain has run
   on HTTPS for a while.
5. **`upgrade-insecure-requests`.** Left out: every resource is a
   same-origin relative URL, and HSTS keeps the site on HTTPS; the
   directive would only matter for absolute `http:` links, of which there
   are none.
6. **`Cross-Origin-Embedder-Policy: require-corp`.** Left out: it enables
   cross-origin isolation, which nothing here uses, and OWASP warns that it
   blocks misconfigured cross-origin resources [2].
7. **`Referrer-Policy: strict-origin-when-cross-origin`** (OWASP's example).
   Replaced by `no-referrer`, which CLAUDE.md requires for share links and
   the API already sends.

## Consequences

**Positive:**

- Only scripts this server rendered can run; the site cannot be framed;
  responses do not reveal the server software.

**Negative / trade-offs:**

- A new inline script or a resource from another origin (an analytics tag,
  an external font or image) is blocked until the policy allows it; such
  additions change this ADR.
- HSTS binds the domain to HTTPS for two years once a browser has seen it.

## Verified (2026-10-13)

Production build (`next build`, `next start`), locally:

- Every page is dynamic and the proxy is registered (build output).
- `/login` returned all eight headers above and no `X-Powered-By`; two
  requests carried different nonces, and all nine `<script>` tags of each
  page carried that request's nonce. No `'unsafe-eval'` in production.
- In Chrome, signing in, the applications list (with its column widths),
  and navigation logged no Content Security Policy violation in the console
  or the Issues panel. The only console errors came from Google's sign-in
  page (its analytics requests, blocked by a browser extension). The
  Issues panel's one note, a form field without `name`, was the page-size
  select, which now has one.

## References

1. [How to set a Content Security Policy (CSP) for your Next.js application — Next.js 16.4 docs](https://nextjs.org/docs/app/guides/content-security-policy)
2. [HTTP Headers Cheat Sheet — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
