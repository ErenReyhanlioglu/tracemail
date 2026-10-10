// Next.js configuration: standalone output for the VM (ADR-0016), and the
// API proxied under /api so browser and API share one origin (ADR-0032).
import type { NextConfig } from "next";

const apiUrl = process.env.TRACEMAIL_API_URL;
if (!apiUrl) {
  throw new Error("TRACEMAIL_API_URL is not set");
}

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
};

export default config;
