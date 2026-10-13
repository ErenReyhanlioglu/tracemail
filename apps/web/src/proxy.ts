// Content Security Policy with a fresh nonce per request (ADR-0038). Next.js
// reads the nonce from the request's CSP header and adds it to its own
// scripts and inline styles, so only scripts this server rendered can run.
// Every page already renders per request (the root layout reads the theme
// cookie), so a nonce costs no static optimization.
import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

// React uses eval in development only, for server error stacks.
const DEV_SCRIPT_SOURCES = isDev ? " 'unsafe-eval'" : "";

export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${DEV_SCRIPT_SOURCES}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Style attributes (table column widths) cannot carry a nonce; with
    // default-src 'self' they cannot load anything from elsewhere.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Pages only: not the API (JSON), static files, app icons, or link
// prefetches. The icons are static images; icon.svg carries its own <style>
// for the dark theme, which a page's nonce-based policy would block.
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
