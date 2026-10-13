// Next.js configuration: standalone output for the VM (ADR-0016), the API
// proxied under /api so browser and API share one origin (ADR-0032), and
// the security headers every response carries (ADR-0038). The Content
// Security Policy is set per request in src/proxy.ts, since it needs a nonce.
import type { NextConfig } from "next";

const apiUrl = process.env.TRACEMAIL_API_URL;
if (!apiUrl) {
  throw new Error("TRACEMAIL_API_URL is not set");
}

// Values follow OWASP's HTTP Headers Cheat Sheet, except Referrer-Policy,
// which is no-referrer so share-link tokens never leak (CLAUDE.md, Privacy).
// HSTS has no preload: preloading is hard to undo. Browsers ignore HSTS on
// plain HTTP, so it has no effect locally.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Project instructions live in CLAUDE.md; no generated AGENTS.md.
  agentRules: false,
  // Keep the development indicator clear of the sidebar's sign-out link.
  devIndicators: { position: "bottom-right" },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default config;
